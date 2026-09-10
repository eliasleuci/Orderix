import { Router } from 'express';
import { authMiddleware } from '../../common/middlewares/authMiddleware';
import { roleMiddleware } from '../../common/middlewares/roleMiddleware';
import { validate } from '../../common/middlewares/validationMiddleware';
import { TenantsController } from './tenants.controller';
import { BranchesController } from './branches.controller';
import { UsersController } from './users.controller';
import { BillingController } from './billing.controller';
import * as s from './schemas';

const router = Router();

const tenants = new TenantsController();
const branches = new BranchesController();
const users = new UsersController();
const billing = new BillingController();

// Todo el módulo es exclusivo del dueño de la plataforma.
router.use(authMiddleware);
router.use(roleMiddleware(['SUPER_ADMIN']));

// ---------- Facturación (antes de /tenants/:id para que no lo capture) ----------
router.get('/billing/overview', billing.overview);

// ---------- Perfiles huérfanos ----------
router.get('/orphan-profiles', users.listOrphans);
router.delete('/orphan-profiles', users.removeOrphans);

// ---------- Clientes ----------
router.get('/tenants', tenants.list);
router.post('/tenants', validate(s.createTenantSchema), tenants.create);
router.get('/tenants/:id', tenants.detail);
router.patch('/tenants/:id', validate(s.updateTenantSchema), tenants.update);
router.patch('/tenants/:id/status', validate(s.tenantStatusSchema), tenants.toggleStatus);
router.delete('/tenants/:id', validate(s.deleteTenantSchema), tenants.remove);
router.post('/tenants/:id/reset-admin-password', validate(s.userPasswordSchema), tenants.resetAdminPassword);

// ---------- Sucursales ----------
router.get('/tenants/:tenantId/branches', branches.list);
router.post('/tenants/:tenantId/branches', validate(s.createBranchSchema), branches.create);
router.patch('/branches/:id', validate(s.updateBranchSchema), branches.update);
router.patch('/branches/:id/status', validate(s.branchStatusSchema), branches.toggleStatus);
router.delete('/branches/:id', branches.remove);

// ---------- Usuarios ----------
router.get('/tenants/:tenantId/users', users.list);
router.post('/tenants/:tenantId/users', validate(s.createUserSchema), users.create);
router.patch('/users/:id', validate(s.updateUserSchema), users.update);
router.post('/users/:id/password', validate(s.userPasswordSchema), users.changePassword);
router.delete('/users/:id', users.remove);

// ---------- Pagos de un cliente ----------
router.get('/tenants/:id/payments', billing.listPayments);
router.post('/tenants/:id/payments', validate(s.createPaymentSchema), billing.createPayment);
router.patch('/tenants/:id/subscription', validate(s.updateSubscriptionSchema), billing.updateSubscription);

export default router;
