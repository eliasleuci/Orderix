import { Request, Response, NextFunction } from 'express';
import { basePrisma } from '../../config/database';
import { AppError } from '../../common/exceptions/AppError';
import { logger } from '../../common/utils/logger';
import { computeBillingState, diasRestantes, BillingState } from './billing.utils';

// Ver tenants.controller.ts: excluye perfiles SUPER_ADMIN huérfanos del conteo.
const usersDelCliente = { where: { role: { not: 'SUPER_ADMIN' } } } as const;

/**
 * El middleware `validate` sólo valida contra el schema: no reescribe req.body.
 * Por eso las fechas llegan como string aunque zod las declare como date, y
 * Prisma las rechaza por no ser ISO-8601 completo.
 */
const aFecha = (v: unknown): Date | null => {
  if (v === null || v === undefined || v === '') return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
};

const ORDEN_ESTADO: Record<BillingState, number> = {
  VENCIDO: 0,
  POR_VENCER: 1,
  SIN_FECHA: 2,
  AL_DIA: 3,
};

export class BillingController {
  /** GET /api/superadmin/billing/overview — quién está al día y quién por vencer */
  overview = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenants = await basePrisma.tenant.findMany({
        include: {
          payments: { orderBy: { paidAt: 'desc' }, take: 1 },
          _count: { select: { branches: true, users: usersDelCliente } },
        },
      });

      const filas = tenants.map((t) => {
        const ultimo = t.payments[0] ?? null;
        return {
          id: t.id,
          name: t.name,
          slug: t.slug,
          email: t.email,
          isActive: t.isActive,
          subscriptionStatus: t.subscriptionStatus,
          subscriptionExpiresAt: t.subscriptionExpiresAt,
          billingState: computeBillingState(t.subscriptionExpiresAt, t.isActive),
          diasRestantes: diasRestantes(t.subscriptionExpiresAt),
          ultimoPago: ultimo ? { paidAt: ultimo.paidAt, amount: ultimo.amount, periodEnd: ultimo.periodEnd } : null,
          sucursales: t._count.branches,
          usuarios: t._count.users,
          notes: t.notes,
        };
      });

      // Primero lo que requiere acción: vencidos, después por vencer.
      filas.sort((a, b) => {
        const d = ORDEN_ESTADO[a.billingState] - ORDEN_ESTADO[b.billingState];
        if (d !== 0) return d;
        return (a.diasRestantes ?? 9999) - (b.diasRestantes ?? 9999);
      });

      const resumen = {
        total: filas.length,
        alDia: filas.filter((f) => f.billingState === 'AL_DIA').length,
        porVencer: filas.filter((f) => f.billingState === 'POR_VENCER').length,
        vencidos: filas.filter((f) => f.billingState === 'VENCIDO').length,
        sinFecha: filas.filter((f) => f.billingState === 'SIN_FECHA').length,
      };

      res.json({ status: 'success', data: { resumen, clientes: filas } });
    } catch (error) {
      next(error);
    }
  };

  /** GET /api/superadmin/tenants/:id/payments */
  listPayments = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = String(req.params.id);

      const pagos = await basePrisma.tenantPayment.findMany({
        where: { tenantId },
        orderBy: { paidAt: 'desc' },
      });

      // created_by apunta a profiles, que puede haberse borrado: se resuelve
      // aparte para no perder el pago si el usuario que lo cargó ya no está.
      const ids = [...new Set(pagos.map((p) => p.createdBy).filter(Boolean))] as string[];
      const autores = ids.length
        ? await basePrisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true } })
        : [];
      const porId = new Map(autores.map((a) => [a.id, a.email]));

      res.json({
        status: 'success',
        data: pagos.map((p) => ({ ...p, registradoPor: p.createdBy ? porId.get(p.createdBy) ?? null : null })),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/superadmin/tenants/:id/payments — registrar un pago.
   *
   * Deja el pago en el historial y adelanta la fecha de vencimiento del cliente,
   * en una sola transacción: si una de las dos falla, no queda a medias.
   */
  createPayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = String(req.params.id);
      const { amount, currency, paidAt, periodStart, periodEnd, method, notes } = req.body;

      const tenant = await basePrisma.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) throw new AppError('Cliente no encontrado', 404);

      const fin = aFecha(periodEnd);
      if (!fin) throw new AppError('Fecha de vencimiento inválida', 400);

      const [pago, actualizado] = await basePrisma.$transaction([
        basePrisma.tenantPayment.create({
          data: {
            tenantId,
            amount: amount ?? null,
            currency: currency || 'ARS',
            paidAt: aFecha(paidAt) ?? new Date(),
            periodStart: aFecha(periodStart),
            periodEnd: fin,
            method: method || null,
            notes: notes || null,
            createdBy: req.user?.id ?? null,
          },
        }),
        basePrisma.tenant.update({
          where: { id: tenantId },
          data: {
            subscriptionExpiresAt: fin,
            subscriptionStatus: 'ACTIVE',
            // Registrar un pago reactiva a un cliente suspendido por falta de pago.
            isActive: true,
          },
        }),
      ]);

      logger.info(`Pago registrado para ${tenant.name} hasta ${periodEnd} por ${req.user?.id}`);

      res.status(201).json({
        status: 'success',
        data: {
          pago,
          cliente: {
            ...actualizado,
            billingState: computeBillingState(actualizado.subscriptionExpiresAt, actualizado.isActive),
            diasRestantes: diasRestantes(actualizado.subscriptionExpiresAt),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /** PATCH /api/superadmin/tenants/:id/subscription — ajuste manual */
  updateSubscription = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const { status, expiresAt, suspend } = req.body;

      if (suspend && id === req.user?.tenantId) {
        throw new AppError('No podés suspender tu propia cuenta de plataforma', 400);
      }

      const tenant = await basePrisma.tenant.update({
        where: { id },
        data: {
          ...(status !== undefined && { subscriptionStatus: status }),
          ...(expiresAt !== undefined && { subscriptionExpiresAt: aFecha(expiresAt) }),
          // Marcar vencido y cortar el acceso, en un solo paso.
          ...(suspend === true && { isActive: false, subscriptionStatus: status ?? 'EXPIRED' }),
        },
      });

      res.json({
        status: 'success',
        data: {
          ...tenant,
          billingState: computeBillingState(tenant.subscriptionExpiresAt, tenant.isActive),
          diasRestantes: diasRestantes(tenant.subscriptionExpiresAt),
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
