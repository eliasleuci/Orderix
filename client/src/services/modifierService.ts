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

  /**
   * Copia un grupo (y sus opciones) a otros productos. Son copias
   * independientes, no un grupo compartido: cada producto sigue teniendo su
   * propia fila y editar el precio en uno no toca a los demás. Existe sólo
   * para no tener que tipear la misma lista de extras producto por producto
   * cuando varios comparten los mismos.
   */
  async copiarGrupoAProductos(
    grupo: GrupoDeExtras,
    opciones: OpcionDeExtra[],
    productIds: string[],
    tenantId: string
  ): Promise<ServiceResponse<number>> {
    let copiados = 0;

    for (const productId of productIds) {
      const { data: nuevoGrupo, error: errGrupo } = await this.crearGrupo({
        tenant_id: tenantId,
        branch_id: grupo.branch_id,
        product_id: productId,
        name: grupo.name,
        min_select: grupo.min_select,
        max_select: grupo.max_select,
      });
      if (errGrupo || !nuevoGrupo) return { data: copiados, error: errGrupo || 'No se pudo copiar el grupo' };

      if (opciones.length > 0) {
        const { error: errOpciones } = await supabase.from('modifier_options').insert(
          opciones.map((o) => ({
            tenant_id: tenantId,
            group_id: nuevoGrupo.id,
            name: o.name,
            price: o.price,
            display_order: o.display_order,
          }))
        );
        if (errOpciones) return { data: copiados, error: errOpciones.message };
      }

      copiados += 1;
    }

    return { data: copiados, error: null };
  }
}

export const modifierService = new ModifierService();
