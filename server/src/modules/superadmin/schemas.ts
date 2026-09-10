import { z } from 'zod';

// z.string().uuid() exige los bits de versión/variante de RFC 4122 y rechaza
// ids "de mentira" puestos a mano en seeds viejos (ej. '11111111-1111-1111-
// 1111-111111111111' del Demo Tenant) aunque Postgres los acepta sin problema
// como ::uuid. Sin este cambio, esos clientes de prueba quedaban imposibles
// de borrar desde el panel -justo lo que el botón existe para resolver-.
// Se valida el formato 8-4-4-4-12 hex, sin exigir esos bits.
const uuid = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Identificador inválido');
const email = z.string().email('Email inválido');
const password = z.string().min(8, 'La contraseña debe tener al menos 8 caracteres');

/** SUPER_ADMIN queda deliberadamente afuera: no se reparte desde el panel. */
export const ROLES_ASIGNABLES = ['ADMIN', 'CASHIER', 'KITCHEN'] as const;
const role = z.enum(ROLES_ASIGNABLES);

const slug = z
  .string()
  .min(2, 'El identificador es muy corto')
  .max(60, 'El identificador es muy largo')
  .regex(/^[a-z0-9-]+$/, 'El identificador sólo admite minúsculas, números y guiones');

// ---------- Clientes ----------

export const createTenantSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'El nombre es obligatorio'),
    slug,
    email: email.optional().or(z.literal('')),
    phone: z.string().optional(),
    branchName: z.string().min(2).optional(),
    branchLocation: z.string().optional(),
    adminEmail: email,
    adminPassword: password,
  }),
});

export const updateTenantSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({
    name: z.string().min(2).optional(),
    slug: slug.optional(),
    email: email.optional().or(z.literal('')),
    phone: z.string().optional(),
    notes: z.string().optional(),
  }),
});

export const tenantStatusSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({ isActive: z.boolean() }),
});

export const deleteTenantSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({
    confirmSlug: z.string().min(1, 'Escribí el identificador del cliente para confirmar'),
    force: z.boolean().optional(),
  }),
});

// ---------- Sucursales ----------

export const createBranchSchema = z.object({
  params: z.object({ tenantId: uuid }),
  body: z.object({
    name: z.string().min(2, 'El nombre de la sucursal es obligatorio'),
    location: z.string().optional(),
    email: email.optional().or(z.literal('')),
    phone: z.string().optional(),
  }),
});

export const updateBranchSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({
    name: z.string().min(2).optional(),
    location: z.string().optional(),
    email: email.optional().or(z.literal('')),
    phone: z.string().optional(),
  }),
});

export const branchStatusSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({ isActive: z.boolean() }),
});

// ---------- Usuarios ----------

export const createUserSchema = z.object({
  params: z.object({ tenantId: uuid }),
  body: z.object({
    email,
    password,
    role,
    branchId: uuid.optional().nullable(),
    name: z.string().optional(),
  }),
});

export const updateUserSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({
    // Cambia la credencial de acceso en Supabase Auth, no solo el dato guardado
    // en profiles: es el email con el que la persona inicia sesión.
    email: email.optional(),
    role: role.optional(),
    branchId: uuid.optional().nullable(),
    name: z.string().optional(),
  }),
});

export const userPasswordSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({ password }),
});

// ---------- Facturación ----------

export const createPaymentSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({
    amount: z.coerce.number().nonnegative('El monto no puede ser negativo').optional(),
    currency: z.string().optional(),
    paidAt: z.coerce.date().optional(),
    periodStart: z.coerce.date().optional(),
    periodEnd: z.coerce.date({ message: 'Indicá hasta qué fecha queda paga la suscripción' }),
    method: z.string().optional(),
    notes: z.string().optional(),
  }),
});

export const updateSubscriptionSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({
    status: z.enum(['ACTIVE', 'EXPIRED', 'PENDING_PAYMENT']).optional(),
    expiresAt: z.coerce.date().nullable().optional(),
    suspend: z.boolean().optional(),
  }),
});
