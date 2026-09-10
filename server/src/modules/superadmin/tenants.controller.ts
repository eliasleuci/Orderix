import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
// basePrisma y no prisma: la extensión de tenant inyecta el tenantId del usuario
// logueado en toda query salvo el modelo Tenant. Como el SUPER_ADMIN vive en su
// propio tenant, el cliente extendido devolvería listas vacías y escribiría los
// registros nuevos en el tenant equivocado.
import { basePrisma } from '../../config/database';
import { AppError } from '../../common/exceptions/AppError';
import { logger } from '../../common/utils/logger';
import { getSupabaseAdmin, mapAuthError } from './supabaseAdmin';
import { computeBillingState, diasRestantes } from './billing.utils';

// Perfiles SUPER_ADMIN colgados de un tenant son basura de borrados anteriores
// (la cascada auth.users -> profiles no siempre actuó en esta base), no
// usuarios del cliente. Se excluyen de todo conteo para no inflar la cifra
// que ve el dueño de la plataforma en el listado y las tarjetas.
const usersDelCliente = { where: { role: { not: 'SUPER_ADMIN' } } } as const;

const withBilling = (t: any) => ({
  ...t,
  billingState: computeBillingState(t.subscriptionExpiresAt, t.isActive),
  diasRestantes: diasRestantes(t.subscriptionExpiresAt),
});

export class TenantsController {
  /** GET /api/superadmin/tenants */
  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
      const status = req.query.status;

      const where: any = {};
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { slug: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (status === 'active') where.isActive = true;
      if (status === 'suspended') where.isActive = false;

      const tenants = await basePrisma.tenant.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { branches: true, users: usersDelCliente, products: true, orders: true } },
        },
      });

      res.json({ status: 'success', data: tenants.map(withBilling) });
    } catch (error) {
      next(error);
    }
  };

  /** GET /api/superadmin/tenants/:id */
  detail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);

      const tenant = await basePrisma.tenant.findUnique({
        where: { id },
        include: {
          branches: {
            orderBy: { createdAt: 'asc' },
            include: { _count: { select: { users: usersDelCliente, orders: true, products: true } } },
          },
          users: {
            where: { role: { not: 'SUPER_ADMIN' } },
            orderBy: { email: 'asc' },
            select: { id: true, email: true, name: true, role: true, branchId: true, createdAt: true },
          },
          payments: { orderBy: { paidAt: 'desc' }, take: 12 },
          _count: { select: { products: true, orders: true } },
        },
      });

      if (!tenant) throw new AppError('Cliente no encontrado', 404);

      res.json({ status: 'success', data: withBilling(tenant) });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/superadmin/tenants — alta de cliente.
   *
   * auth.users vive fuera de la transacción de Postgres, así que el orden importa:
   * primero lo que se puede deshacer sin daño (tenant y sucursal, vacíos), y la
   * cuenta de Auth al final. Si algo falla, se compensa hacia atrás.
   */
  create = async (req: Request, res: Response, next: NextFunction) => {
    const { name, slug, email, phone, branchName, branchLocation, adminEmail, adminPassword } = req.body;

    let tenantId: string | null = null;
    let branchId: string | null = null;
    let authUserId: string | null = null;

    try {
      const slugTomado = await basePrisma.tenant.findUnique({ where: { slug } });
      if (slugTomado) {
        throw new AppError(`Ya existe un cliente con el identificador "${slug}"`, 409);
      }

      const supabaseAdmin = getSupabaseAdmin();

      const tenant = await basePrisma.tenant.create({
        data: {
          name,
          slug,
          email: email || adminEmail,
          phone: phone || null,
          isActive: true,
          subscriptionStatus: 'ACTIVE',
        },
      });
      tenantId = tenant.id;

      const branch = await basePrisma.branch.create({
        data: {
          tenantId: tenant.id,
          name: branchName || 'Casa Central',
          location: branchLocation || null,
          email: email || adminEmail,
          phone: phone || null,
          isActive: true,
        },
      });
      branchId = branch.id;

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
      });

      if (authError || !authData.user) {
        throw mapAuthError(authError?.message ?? 'No se pudo crear el usuario');
      }
      authUserId = authData.user.id;

      // El login local (/api/auth/login) compara contra este hash, así que hay que
      // mantenerlo sincronizado con la contraseña de Supabase Auth.
      await basePrisma.user.create({
        data: {
          id: authData.user.id,
          email: adminEmail,
          password: await bcrypt.hash(adminPassword, 10),
          name: `Admin (${name})`,
          role: 'ADMIN',
          tenantId: tenant.id,
          branchId: branch.id,
        },
      });

      const creado = await basePrisma.tenant.findUnique({
        where: { id: tenant.id },
        include: { branches: true, _count: { select: { branches: true, users: usersDelCliente } } },
      });

      res.status(201).json({ status: 'success', data: withBilling(creado) });
    } catch (error) {
      await this.compensarAlta({ tenantId, branchId, authUserId });
      next(error);
    }
  };

  /** Deshace un alta a medias. Cada paso aislado: que falle uno no debe tapar el error original. */
  private compensarAlta = async (ids: {
    tenantId: string | null;
    branchId: string | null;
    authUserId: string | null;
  }) => {
    if (ids.authUserId) {
      try {
        await getSupabaseAdmin().auth.admin.deleteUser(ids.authUserId);
      } catch (e: any) {
        logger.error(`Alta fallida: quedó el usuario de Auth ${ids.authUserId} sin borrar (${e.message})`);
      }
    }
    if (ids.branchId) {
      try {
        await basePrisma.branch.delete({ where: { id: ids.branchId } });
      } catch (e: any) {
        logger.error(`Alta fallida: no se pudo borrar la sucursal ${ids.branchId} (${e.message})`);
      }
    }
    if (ids.tenantId) {
      try {
        await basePrisma.tenant.delete({ where: { id: ids.tenantId } });
      } catch (e: any) {
        logger.error(`Alta fallida: no se pudo borrar el cliente ${ids.tenantId} (${e.message})`);
      }
    }
  };

  /** PATCH /api/superadmin/tenants/:id */
  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const { name, slug, email, phone, notes } = req.body;

      if (slug) {
        const otro = await basePrisma.tenant.findUnique({ where: { slug } });
        if (otro && otro.id !== id) {
          throw new AppError(`Ya existe otro cliente con el identificador "${slug}"`, 409);
        }
      }

      const tenant = await basePrisma.tenant.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(slug !== undefined && { slug }),
          ...(email !== undefined && { email: email || null }),
          ...(phone !== undefined && { phone: phone || null }),
          ...(notes !== undefined && { notes: notes || null }),
        },
      });

      res.json({ status: 'success', data: withBilling(tenant) });
    } catch (error) {
      next(error);
    }
  };

  /** PATCH /api/superadmin/tenants/:id/status — suspender o reactivar (reversible) */
  toggleStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const { isActive } = req.body;

      if (id === req.user?.tenantId) {
        throw new AppError('No podés suspender tu propia cuenta de plataforma', 400);
      }

      const tenant = await basePrisma.tenant.update({
        where: { id },
        data: {
          isActive,
          ...(isActive === false && { subscriptionStatus: 'EXPIRED' }),
          ...(isActive === true && { subscriptionStatus: 'ACTIVE' }),
        },
      });

      logger.info(`Cliente ${tenant.name} ${isActive ? 'reactivado' : 'suspendido'} por ${req.user?.id}`);
      res.json({ status: 'success', data: withBilling(tenant) });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/superadmin/tenants/:id — borrado definitivo.
   *
   * Cuatro precondiciones y un orden concreto: los perfiles se leen ANTES del
   * DELETE porque la cascada se los lleva, y sin esa lista no habría forma de
   * limpiar las cuentas de Auth correspondientes.
   */
  remove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const { confirmSlug, force } = req.body;

      const tenant = await basePrisma.tenant.findUnique({
        where: { id },
        include: { _count: { select: { orders: true, products: true, branches: true, users: true } } },
      });
      if (!tenant) throw new AppError('Cliente no encontrado', 404);

      if (id === req.user?.tenantId) {
        throw new AppError('No podés borrar tu propia cuenta de plataforma', 400);
      }
      if (tenant.isActive !== false) {
        throw new AppError('Suspendé el cliente antes de borrarlo definitivamente', 400);
      }
      if (confirmSlug !== tenant.slug) {
        throw new AppError(`Para confirmar, escribí exactamente "${tenant.slug}"`, 400);
      }

      const hace30dias = new Date(Date.now() - 30 * 86_400_000);
      const ventasRecientes = await basePrisma.order.count({
        where: { tenantId: id, createdAt: { gte: hace30dias } },
      });
      if (ventasRecientes > 0 && !force) {
        throw new AppError(
          `Este cliente registró ${ventasRecientes} ventas en los últimos 30 días. ` +
            'Confirmá de nuevo si estás seguro de borrarlo.',
          409
        );
      }

      // 1. Los perfiles, antes que nada: el DELETE los cascadea.
      const perfiles = await basePrisma.user.findMany({
        where: { tenantId: id },
        select: { id: true, email: true },
      });

      // 2. Snapshot para auditoría: es lo único que queda si esto fue un error.
      logger.warn(
        `BORRADO DEFINITIVO de "${tenant.name}" (${tenant.slug}) por ${req.user?.id} | ` +
          `sucursales=${tenant._count.branches} usuarios=${tenant._count.users} ` +
          `productos=${tenant._count.products} ordenes=${tenant._count.orders}`
      );

      // 3. Postgres cascadea el resto.
      await basePrisma.tenant.delete({ where: { id } });

      // 4. Auth al final: si algo falla acá, quedan cuentas sueltas recuperables
      //    con el endpoint de huérfanos, no un cliente sin acceso.
      const authFallidos: string[] = [];
      let authBorrados = 0;
      for (const p of perfiles) {
        try {
          const { error } = await getSupabaseAdmin().auth.admin.deleteUser(p.id);
          if (error) throw new Error(error.message);
          authBorrados++;
        } catch (e: any) {
          authFallidos.push(p.email ?? p.id);
          logger.error(`No se pudo borrar de Auth a ${p.email} (${e.message})`);
        }
      }

      res.json({
        status: 'success',
        data: {
          cliente: tenant.name,
          borrado: tenant._count,
          authBorrados,
          authFallidos,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /** POST /api/superadmin/tenants/:id/reset-admin-password */
  resetAdminPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const { password } = req.body;

      const admin = await basePrisma.user.findFirst({
        where: { tenantId: id, role: 'ADMIN' },
        orderBy: { createdAt: 'asc' },
      });
      if (!admin) throw new AppError('Este cliente no tiene ningún usuario ADMIN', 404);

      const { error } = await getSupabaseAdmin().auth.admin.updateUserById(admin.id, { password });
      if (error) throw mapAuthError(error.message);

      await basePrisma.user.update({
        where: { id: admin.id },
        data: { password: await bcrypt.hash(password, 10) },
      });

      res.json({ status: 'success', message: `Contraseña actualizada para ${admin.email}` });
    } catch (error) {
      next(error);
    }
  };
}
