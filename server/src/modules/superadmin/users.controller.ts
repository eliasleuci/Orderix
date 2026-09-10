import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { basePrisma } from '../../config/database';
import { AppError } from '../../common/exceptions/AppError';
import { logger } from '../../common/utils/logger';
import { getSupabaseAdmin, mapAuthError } from './supabaseAdmin';

export class UsersController {
  /** GET /api/superadmin/tenants/:tenantId/users */
  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = String(req.params.tenantId);

      const users = await basePrisma.user.findMany({
        // SUPER_ADMIN queda afuera: son cuentas de plataforma, no del cliente.
        // Pueden aparecer acá como basura de borrados anteriores (perfil que
        // quedó con este tenant_id) y no se pueden editar ni borrar desde este
        // panel; se limpian con GET/DELETE /orphan-profiles.
        where: { tenantId, role: { not: 'SUPER_ADMIN' } },
        orderBy: [{ role: 'asc' }, { email: 'asc' }],
        include: { branch: { select: { id: true, name: true } } },
      });

      // profiles.email puede estar desactualizado respecto de Auth, y el que
      // sirve para iniciar sesión es el de Auth. Se cruzan para mostrar el real.
      const authPorId = new Map<string, { email?: string; lastSignInAt?: string | null }>();
      try {
        const { data } = await getSupabaseAdmin().auth.admin.listUsers({ page: 1, perPage: 1000 });
        for (const u of data?.users ?? []) {
          authPorId.set(u.id, { email: u.email, lastSignInAt: u.last_sign_in_at });
        }
      } catch (e: any) {
        logger.warn(`No se pudo consultar Supabase Auth para el listado de usuarios: ${e.message}`);
      }

      const data = users.map((u) => {
        const auth = authPorId.get(u.id);
        return {
          id: u.id,
          email: auth?.email ?? u.email,
          emailPerfil: u.email,
          name: u.name,
          role: u.role,
          branchId: u.branchId,
          branchName: u.branch?.name ?? null,
          createdAt: u.createdAt,
          lastSignInAt: auth?.lastSignInAt ?? null,
          // Sin cuenta en Auth no se puede iniciar sesión: es un perfil huérfano.
          tieneCuenta: authPorId.size === 0 ? null : authPorId.has(u.id),
        };
      });

      res.json({ status: 'success', data });
    } catch (error) {
      next(error);
    }
  };

  /** POST /api/superadmin/tenants/:tenantId/users */
  create = async (req: Request, res: Response, next: NextFunction) => {
    const tenantId = String(req.params.tenantId);
    const { email, password, role, branchId, name } = req.body;

    let authUserId: string | null = null;

    try {
      const tenant = await basePrisma.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) throw new AppError('Cliente no encontrado', 404);

      let branchFinal: string | null = branchId ?? null;
      if (branchFinal) {
        const branch = await basePrisma.branch.findUnique({ where: { id: branchFinal } });
        if (!branch || branch.tenantId !== tenantId) {
          throw new AppError('Esa sucursal no pertenece a este cliente', 400);
        }
      } else {
        // Sin sucursal el usuario no puede operar: la app lo manda de vuelta al login.
        const primera = await basePrisma.branch.findFirst({
          where: { tenantId, isActive: true },
          orderBy: { createdAt: 'asc' },
        });
        if (!primera) throw new AppError('El cliente no tiene ninguna sucursal activa', 400);
        branchFinal = primera.id;
      }

      // Sin pre-chequeo contra profiles: no ve las cuentas de Auth sin perfil y
      // además tiene carrera. Se deja que Supabase resuelva el duplicado.
      const { data: authData, error: authError } = await getSupabaseAdmin().auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (authError || !authData.user) {
        throw mapAuthError(authError?.message ?? 'No se pudo crear el usuario');
      }
      authUserId = authData.user.id;

      const user = await basePrisma.user.create({
        data: {
          id: authData.user.id,
          email,
          password: await bcrypt.hash(password, 10),
          name: name || null,
          role,
          tenantId,
          branchId: branchFinal,
        },
        include: { branch: { select: { name: true } } },
      });

      res.status(201).json({ status: 'success', data: user });
    } catch (error) {
      if (authUserId) {
        try {
          await getSupabaseAdmin().auth.admin.deleteUser(authUserId);
        } catch (e: any) {
          logger.error(`Alta fallida: quedó el usuario de Auth ${authUserId} sin borrar (${e.message})`);
        }
      }
      next(error);
    }
  };

  /** PATCH /api/superadmin/users/:id — rol, sucursal, nombre */
  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const { email, role, branchId, name } = req.body;

      if (id === req.user?.id) {
        throw new AppError('No podés editar tu propio usuario desde el panel', 400);
      }

      const actual = await basePrisma.user.findUnique({ where: { id } });
      if (!actual) throw new AppError('Usuario no encontrado', 404);

      if (actual.role === 'SUPER_ADMIN') {
        throw new AppError('Los usuarios de plataforma no se editan desde acá', 403);
      }

      if (branchId) {
        const branch = await basePrisma.branch.findUnique({ where: { id: branchId } });
        if (!branch || branch.tenantId !== actual.tenantId) {
          throw new AppError('Esa sucursal no pertenece al cliente del usuario', 400);
        }
      }

      // El email de acceso vive en Supabase Auth, no en profiles: cambiarlo solo
      // en la tabla dejaria a la persona iniciando sesion con el email viejo.
      if (email !== undefined) {
        const { error } = await getSupabaseAdmin().auth.admin.updateUserById(id, {
          email,
          email_confirm: true,
        });
        if (error) throw mapAuthError(error.message);
      }

      const user = await basePrisma.user.update({
        where: { id },
        data: {
          // profiles.email se mantiene al dia solo para que las consultas
          // directas a la tabla no muestren un dato viejo; el que manda es Auth.
          ...(email !== undefined && { email }),
          ...(role !== undefined && { role }),
          ...(branchId !== undefined && { branchId }),
          ...(name !== undefined && { name: name || null }),
        },
        include: { branch: { select: { name: true } } },
      });

      res.json({ status: 'success', data: user });
    } catch (error) {
      next(error);
    }
  };

  /** POST /api/superadmin/users/:id/password */
  changePassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const { password } = req.body;

      const user = await basePrisma.user.findUnique({ where: { id } });
      if (!user) throw new AppError('Usuario no encontrado', 404);

      const { error } = await getSupabaseAdmin().auth.admin.updateUserById(id, { password });
      if (error) throw mapAuthError(error.message);

      await basePrisma.user.update({
        where: { id },
        data: { password: await bcrypt.hash(password, 10) },
      });

      res.json({ status: 'success', message: `Contraseña actualizada para ${user.email}` });
    } catch (error) {
      next(error);
    }
  };

  /** DELETE /api/superadmin/users/:id — baja definitiva */
  remove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);

      if (id === req.user?.id) {
        throw new AppError('No podés borrar tu propio usuario', 400);
      }

      const user = await basePrisma.user.findUnique({ where: { id } });
      if (!user) throw new AppError('Usuario no encontrado', 404);

      if (user.role === 'SUPER_ADMIN') {
        throw new AppError('Los usuarios de plataforma no se borran desde acá', 403);
      }

      // Borrar la cuenta de Auth es lo que realmente le quita el acceso.
      const { error } = await getSupabaseAdmin().auth.admin.deleteUser(id);
      if (error && !error.message.toLowerCase().includes('not found')) {
        throw mapAuthError(error.message);
      }

      // El perfil debería irse en cascada, pero en esta base esa cascada no está
      // actuando (hay perfiles huérfanos de borrados anteriores), así que se
      // borra explícitamente.
      await basePrisma.user.deleteMany({ where: { id } });

      logger.info(`Usuario ${user.email} dado de baja por ${req.user?.id}`);
      res.json({ status: 'success', data: { id, email: user.email } });
    } catch (error) {
      next(error);
    }
  };

  /** GET /api/superadmin/orphan-profiles — perfiles sin cuenta de Auth */
  listOrphans = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { data, error } = await getSupabaseAdmin().auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (error) throw mapAuthError(error.message);

      const idsAuth = new Set((data?.users ?? []).map((u) => u.id));

      const perfiles = await basePrisma.user.findMany({
        include: { tenant: { select: { name: true } } },
        orderBy: { email: 'asc' },
      });

      const huerfanos = perfiles
        .filter((p) => !idsAuth.has(p.id))
        .map((p) => ({
          id: p.id,
          email: p.email,
          role: p.role,
          tenant: p.tenant?.name ?? null,
          createdAt: p.createdAt,
        }));

      res.json({ status: 'success', data: huerfanos });
    } catch (error) {
      next(error);
    }
  };

  /** DELETE /api/superadmin/orphan-profiles — borra sólo los ids indicados */
  removeOrphans = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        throw new AppError('Indicá qué perfiles borrar', 400);
      }

      // Nunca "borrar todos los huérfanos" a ciegas: se revalida contra Auth que
      // cada id sea realmente huérfano antes de tocarlo.
      const { data, error } = await getSupabaseAdmin().auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (error) throw mapAuthError(error.message);
      const idsAuth = new Set((data?.users ?? []).map((u) => u.id));

      const conCuenta = ids.filter((id: string) => idsAuth.has(id));
      if (conCuenta.length > 0) {
        throw new AppError('Algunos de esos perfiles sí tienen cuenta activa. No se borró nada.', 400);
      }

      const { count } = await basePrisma.user.deleteMany({ where: { id: { in: ids } } });
      logger.info(`${count} perfiles huérfanos borrados por ${req.user?.id}`);

      res.json({ status: 'success', data: { borrados: count } });
    } catch (error) {
      next(error);
    }
  };
}
