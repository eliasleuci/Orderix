import type { AxiosResponse } from 'axios';
import { baseApi } from './api';
import { ServiceResponse } from '../types/domain';
import type {
  SuperAdminTenant,
  SuperAdminBranch,
  SuperAdminUser,
  TenantDetail,
  TenantPayment,
  BillingOverview,
  OrphanProfile,
  CreateTenantPayload,
  BranchPayload,
  CreateUserPayload,
  PaymentPayload,
} from '../types/superadmin';

/**
 * Panel de plataforma. A diferencia del resto de la app, que habla directo con
 * Supabase, todo esto pasa por el backend Express: crear, borrar y cambiar
 * contraseñas de usuarios requiere la service role key, que no puede vivir en
 * el navegador.
 */
class SuperAdminService {
  /** Traduce cualquier fallo de axios al contrato ServiceResponse del resto de la app. */
  private async run<T>(fn: () => Promise<AxiosResponse>): Promise<ServiceResponse<T>> {
    try {
      const res = await fn();
      return { data: (res.data?.data ?? null) as T, error: null };
    } catch (err: any) {
      const error =
        err.response?.data?.message ||
        (err.response
          ? `El servidor respondió ${err.response.status}`
          : 'No se pudo contactar al servidor');
      return { data: null, error };
    }
  }

  // ---------- Clientes ----------

  getTenants(params?: { search?: string; status?: 'active' | 'suspended' }) {
    return this.run<SuperAdminTenant[]>(() => baseApi.get('/superadmin/tenants', { params }));
  }

  getTenant(id: string) {
    return this.run<TenantDetail>(() => baseApi.get(`/superadmin/tenants/${id}`));
  }

  createTenant(payload: CreateTenantPayload) {
    return this.run<SuperAdminTenant>(() => baseApi.post('/superadmin/tenants', payload));
  }

  updateTenant(id: string, payload: Partial<CreateTenantPayload> & { notes?: string }) {
    return this.run<SuperAdminTenant>(() => baseApi.patch(`/superadmin/tenants/${id}`, payload));
  }

  setTenantStatus(id: string, isActive: boolean) {
    return this.run<SuperAdminTenant>(() =>
      baseApi.patch(`/superadmin/tenants/${id}/status`, { isActive })
    );
  }

  deleteTenant(id: string, confirmSlug: string, force = false) {
    return this.run<{ cliente: string; authBorrados: number; authFallidos: string[] }>(() =>
      baseApi.delete(`/superadmin/tenants/${id}`, { data: { confirmSlug, force } })
    );
  }

  resetAdminPassword(id: string, password: string) {
    return this.run<null>(() =>
      baseApi.post(`/superadmin/tenants/${id}/reset-admin-password`, { password })
    );
  }

  // ---------- Sucursales ----------

  getBranches(tenantId: string) {
    return this.run<SuperAdminBranch[]>(() => baseApi.get(`/superadmin/tenants/${tenantId}/branches`));
  }

  createBranch(tenantId: string, payload: BranchPayload) {
    return this.run<SuperAdminBranch>(() =>
      baseApi.post(`/superadmin/tenants/${tenantId}/branches`, payload)
    );
  }

  updateBranch(id: string, payload: BranchPayload) {
    return this.run<SuperAdminBranch>(() => baseApi.patch(`/superadmin/branches/${id}`, payload));
  }

  setBranchStatus(id: string, isActive: boolean) {
    return this.run<SuperAdminBranch>(() =>
      baseApi.patch(`/superadmin/branches/${id}/status`, { isActive })
    );
  }

  deleteBranch(id: string) {
    return this.run<{ id: string; name: string }>(() => baseApi.delete(`/superadmin/branches/${id}`));
  }

  // ---------- Usuarios ----------

  getUsers(tenantId: string) {
    return this.run<SuperAdminUser[]>(() => baseApi.get(`/superadmin/tenants/${tenantId}/users`));
  }

  createUser(tenantId: string, payload: CreateUserPayload) {
    return this.run<SuperAdminUser>(() =>
      baseApi.post(`/superadmin/tenants/${tenantId}/users`, payload)
    );
  }

  updateUser(id: string, payload: { role?: string; branchId?: string | null; name?: string }) {
    return this.run<SuperAdminUser>(() => baseApi.patch(`/superadmin/users/${id}`, payload));
  }

  setUserPassword(id: string, password: string) {
    return this.run<null>(() => baseApi.post(`/superadmin/users/${id}/password`, { password }));
  }

  deleteUser(id: string) {
    return this.run<{ id: string; email: string }>(() => baseApi.delete(`/superadmin/users/${id}`));
  }

  // ---------- Facturación ----------

  getBillingOverview() {
    return this.run<BillingOverview>(() => baseApi.get('/superadmin/billing/overview'));
  }

  getPayments(tenantId: string) {
    return this.run<TenantPayment[]>(() => baseApi.get(`/superadmin/tenants/${tenantId}/payments`));
  }

  registerPayment(tenantId: string, payload: PaymentPayload) {
    return this.run<{ pago: TenantPayment; cliente: SuperAdminTenant }>(() =>
      baseApi.post(`/superadmin/tenants/${tenantId}/payments`, payload)
    );
  }

  updateSubscription(
    tenantId: string,
    payload: { status?: string; expiresAt?: string | null; suspend?: boolean }
  ) {
    return this.run<SuperAdminTenant>(() =>
      baseApi.patch(`/superadmin/tenants/${tenantId}/subscription`, payload)
    );
  }

  // ---------- Mantenimiento ----------

  getOrphanProfiles() {
    return this.run<OrphanProfile[]>(() => baseApi.get('/superadmin/orphan-profiles'));
  }

  deleteOrphanProfiles(ids: string[]) {
    return this.run<{ borrados: number }>(() =>
      baseApi.delete('/superadmin/orphan-profiles', { data: { ids } })
    );
  }
}

export const superadminService = new SuperAdminService();
