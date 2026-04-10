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
}

export const authService = new AuthService();
