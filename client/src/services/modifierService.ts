import { supabase } from '../lib/supabase';
import { ServiceResponse } from '../types/domain';

export interface GrupoDeExtras {
  id: string;
  product_id: string;
  branch_id: string;
  name: string;
  min_select: number;
  max_select: number | null;
  display_order: number;
  is_active: boolean;
}

export interface OpcionDeExtra {
  id: string;
  group_id: string;
  name: string;
  price: number;
  display_order: number;
  is_active: boolean;
}

class ModifierService {
  async getGrupos(productId: string): Promise<ServiceResponse<GrupoDeExtras[]>> {
    const { data, error } = await supabase
      .from('modifier_groups')
      .select('*')
      .eq('product_id', productId)
      .order('display_order');
    return { data, error: error?.message || null };
  }

  async getOpciones(groupIds: string[]): Promise<ServiceResponse<OpcionDeExtra[]>> {
    if (groupIds.length === 0) return { data: [], error: null };
    const { data, error } = await supabase
      .from('modifier_options')
      .select('*')
      .in('group_id', groupIds)
      .order('display_order');
    return { data, error: error?.message || null };
  }

  async crearGrupo(g: {
    tenant_id: string;
    branch_id: string;
    product_id: string;
    name: string;
    min_select: number;
    max_select: number | null;
  }): Promise<ServiceResponse<GrupoDeExtras>> {
    const { data, error } = await supabase.from('modifier_groups').insert([g]).select().single();
    return { data, error: error?.message || null };
  }

  async actualizarGrupo(id: string, cambios: Partial<GrupoDeExtras>): Promise<ServiceResponse<GrupoDeExtras>> {
    const { data, error } = await supabase
      .from('modifier_groups')
      .update(cambios)
      .eq('id', id)
      .select()
      .single();
    return { data, error: error?.message || null };
  }

  async borrarGrupo(id: string): Promise<ServiceResponse<boolean>> {
    const { error } = await supabase.from('modifier_groups').delete().eq('id', id);
    return { data: !error, error: error?.message || null };
  }

  async crearOpcion(o: {
    tenant_id: string;
    group_id: string;
    name: string;
    price: number;
  }): Promise<ServiceResponse<OpcionDeExtra>> {
    const { data, error } = await supabase.from('modifier_options').insert([o]).select().single();
    return { data, error: error?.message || null };
  }

  async actualizarOpcion(id: string, cambios: Partial<OpcionDeExtra>): Promise<ServiceResponse<OpcionDeExtra>> {
    const { data, error } = await supabase
      .from('modifier_options')
      .update(cambios)
      .eq('id', id)
      .select()
      .single();
    return { data, error: error?.message || null };
  }

  async borrarOpcion(id: string): Promise<ServiceResponse<boolean>> {
    const { error } = await supabase.from('modifier_options').delete().eq('id', id);
    return { data: !error, error: error?.message || null };
  }
}

export const modifierService = new ModifierService();
