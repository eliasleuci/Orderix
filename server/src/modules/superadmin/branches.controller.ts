import { Request, Response, NextFunction } from 'express';
import { basePrisma } from '../../config/database';
import { AppError } from '../../common/exceptions/AppError';
import { logger } from '../../common/utils/logger';

// Ver tenants.controller.ts: perfiles SUPER_ADMIN colgados de una sucursal son
// basura de borrados anteriores, no usuarios reales de esa sucursal.
const usersDeLaSucursal = { where: { role: { not: 'SUPER_ADMIN' } } } as const;

export class BranchesController {
  /** GET /api/superadmin/tenants/:tenantId/branches */
  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = String(req.params.tenantId);

      const branches = await basePrisma.branch.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'asc' },
        include: { _count: { select: { users: usersDeLaSucursal, orders: true, products: true } } },
      });

      res.json({ status: 'success', data: branches });
    } catch (error) {
      next(error);
    }
  };

  /** POST /api/superadmin/tenants/:tenantId/branches */
  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = String(req.params.tenantId);
      const { name, location, email, phone } = req.body;

      const tenant = await basePrisma.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) throw new AppError('Cliente no encontrado', 404);

      const repetida = await basePrisma.branch.findFirst({ where: { tenantId, name } });
      if (repetida) {
        throw new AppError(`"${tenant.name}" ya tiene una sucursal llamada "${name}"`, 409);
      }

      const branch = await basePrisma.branch.create({
        data: {
          tenantId,
          name,
          location: location || null,
          email: email || null,
          phone: phone || null,
          isActive: true,
        },
      });

      res.status(201).json({ status: 'success', data: branch });
    } catch (error) {
      next(error);
    }
  };

  /** PATCH /api/superadmin/branches/:id */
  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const { name, location, email, phone } = req.body;

      const branch = await basePrisma.branch.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(location !== undefined && { location: location || null }),
          ...(email !== undefined && { email: email || null }),
          ...(phone !== undefined && { phone: phone || null }),
        },
      });

      res.json({ status: 'success', data: branch });
    } catch (error) {
      next(error);
    }
  };

  /** PATCH /api/superadmin/branches/:id/status — baja reversible */
  toggleStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const { isActive } = req.body;

      const branch = await basePrisma.branch.update({ where: { id }, data: { isActive } });

      res.json({ status: 'success', data: branch });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/superadmin/branches/:id
   *
   * Borrar una sucursal cascadea a sus usuarios, productos, ingredientes, mesas
   * y órdenes: profiles.branch_id, products.branch_id y orders.branch_id son
   * todos ON DELETE CASCADE. Por eso sólo se permite si está vacía.
   */
  remove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);

      const branch = await basePrisma.branch.findUnique({
        where: { id },
        include: { _count: { select: { users: usersDeLaSucursal, orders: true, products: true } } },
      });
      if (!branch) throw new AppError('Sucursal no encontrada', 404);

      const { users, orders, products } = branch._count;
      if (users > 0 || orders > 0 || products > 0) {
        const detalle = [
          orders > 0 ? `${orders} ventas` : null,
          users > 0 ? `${users} usuarios` : null,
          products > 0 ? `${products} productos` : null,
        ]
          .filter(Boolean)
          .join(', ');

        throw new AppError(
          `No se puede borrar: la sucursal tiene ${detalle}. Desactivala en lugar de borrarla.`,
          409
        );
      }

      const hermanas = await basePrisma.branch.count({ where: { tenantId: branch.tenantId } });
      if (hermanas <= 1) {
        throw new AppError('Es la única sucursal del cliente. Desactivala en lugar de borrarla.', 409);
      }

      await basePrisma.branch.delete({ where: { id } });
      logger.info(`Sucursal "${branch.name}" borrada por ${req.user?.id}`);

      res.json({ status: 'success', data: { id, name: branch.name } });
    } catch (error) {
      next(error);
    }
  };
}
