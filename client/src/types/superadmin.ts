export type BillingState = 'AL_DIA' | 'POR_VENCER' | 'VENCIDO' | 'SIN_FECHA';
export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'PENDING_PAYMENT';
export type AssignableRole = 'ADMIN' | 'CASHIER' | 'KITCHEN';

export interface TenantCounts {
  branches: number;
  users: number;
  products?: number;
  orders?: number;
}

export interface SuperAdminTenant {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  isActive: boolean | null;
  subscriptionStatus: SubscriptionStatus | null;
  subscriptionExpiresAt: string | null;
  createdAt: string | null;
  billingState: BillingState;
  diasRestantes: number | null;
  _count?: TenantCounts;
}

export interface SuperAdminBranch {
  id: string;
  tenantId: string;
  name: string;
  location: string | null;
  email: string | null;
  phone: string | null;
  isActive: boolean | null;
  createdAt: string | null;
  _count?: { users: number; orders: number; products: number };
}

export interface SuperAdminUser {
  id: string;
  email: string | null;
  emailPerfil?: string | null;
  name: string | null;
  role: string | null;
  branchId: string | null;
  branchName: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  /** null cuando no se pudo consultar Supabase Auth. */
  tieneCuenta: boolean | null;
}

export interface TenantPayment {
  id: string;
  tenantId: string;
  amount: string | number | null;
  currency: string | null;
  paidAt: string;
  periodStart: string | null;
  periodEnd: string;
  method: string | null;
  notes: string | null;
  registradoPor: string | null;
}

export interface TenantDetail extends SuperAdminTenant {
  branches: SuperAdminBranch[];
  users: Array<{
    id: string;
    email: string | null;
    name: string | null;
    role: string | null;
    branchId: string | null;
    createdAt: string | null;
  }>;
  payments: TenantPayment[];
}

export interface OrphanProfile {
  id: string;
  email: string | null;
  role: string | null;
  tenant: string | null;
  createdAt: string | null;
}

export interface BillingOverview {
  resumen: {
    total: number;
    alDia: number;
    porVencer: number;
    vencidos: number;
    sinFecha: number;
  };
  clientes: Array<{
    id: string;
    name: string;
    slug: string;
    email: string | null;
    isActive: boolean | null;
    subscriptionStatus: SubscriptionStatus | null;
    subscriptionExpiresAt: string | null;
    billingState: BillingState;
    diasRestantes: number | null;
    ultimoPago: { paidAt: string; amount: string | number | null; periodEnd: string } | null;
    sucursales: number;
    usuarios: number;
    notes: string | null;
  }>;
}

// ---------- Payloads ----------

export interface CreateTenantPayload {
  name: string;
  slug: string;
  email?: string;
  phone?: string;
  branchName?: string;
  branchLocation?: string;
  adminEmail: string;
  adminPassword: string;
}

export interface BranchPayload {
  name: string;
  location?: string;
  email?: string;
  phone?: string;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  role: AssignableRole;
  branchId?: string | null;
  name?: string;
}

export interface PaymentPayload {
  amount?: number;
  currency?: string;
  paidAt?: string;
  periodStart?: string;
  periodEnd: string;
  method?: string;
  notes?: string;
}

export const BILLING_LABELS: Record<BillingState, string> = {
  AL_DIA: 'Al día',
  POR_VENCER: 'Por vencer',
  VENCIDO: 'Vencido',
  SIN_FECHA: 'Sin fecha',
};

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Plataforma',
  ADMIN: 'Administrador',
  CASHIER: 'Cajero',
  KITCHEN: 'Cocina',
};
