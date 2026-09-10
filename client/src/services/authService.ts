import { supabase } from '../lib/supabase';
import { IAuthService } from '../types/services';
import { ServiceResponse, Branch } from '../types/domain';

class AuthService implements IAuthService {
  async signIn(email: string, password: string): Promise<ServiceResponse<any>> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error: error?.message || null };
  }

  async signOut(): Promise<ServiceResponse<void>> {
    const { error } = await supabase.auth.signOut();
    return { data: null, error: error?.message || null };
  }

  async getBranches(): Promise<ServiceResponse<Branch[]>> {
    const { data, error } = await supabase.from('branches').select('*');
    return { data, error: error?.message || null };
  }

  async getTenantBranches(tenantId: string): Promise<ServiceResponse<Branch[]>> {
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });
    return { data, error: error?.message || null };
  }

  async getProfile(userId: string): Promise<ServiceResponse<any>> {
    const { data, error } = await supabase
      .from('profiles')
      .select('role, branch_id, tenant_id')
      .eq('id', userId)
      .single();
    return { data, error: error?.message || null };
  }
  /**
   * Cambio de contraseña del propio usuario.
   *
   * Supabase no pide la contraseña actual en updateUser(), así que la
   * verificamos a mano volviendo a iniciar sesión con ella. Sin esto,
   * cualquiera que agarre una sesión abierta (el navegador del local, por
   * ejemplo) podría cambiar la clave sin conocer la anterior.
   */
  async changePassword(
    email: string,
    currentPassword: string,
    newPassword: string
  ): Promise<ServiceResponse<null>> {
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });

    if (verifyError) {
      return { data: null, error: 'La contraseña actual no es correcta' };
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { data: null, error: error?.message || null };
  }

  /** Define la contraseña nueva. Requiere la sesión que deja el link del mail. */
  async updatePassword(newPassword: string): Promise<ServiceResponse<null>> {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { data: null, error: error?.message || null };
  }

  /** Manda el mail de recuperación con el link a /reset-password. */
  async requestPasswordReset(email: string): Promise<ServiceResponse<null>> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { data: null, error: error?.message || null };
  }
}

export const authService = new AuthService();
