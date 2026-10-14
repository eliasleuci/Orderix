import { supabase } from '../lib/supabase';
import { ServiceResponse } from '../types/domain';
import type { GrupoExtras } from './webshopService';

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
  /**
   * Los extras activos de todos los productos de la sucursal, de una sola vez:
   * la caja los necesita al instante al tocar un producto, no una consulta por
   * toque. Grupos sin opciones activas no se devuelven (no hay nada que elegir).
   */
  async getExtrasDeSucursal(branchId: string): Promise<ServiceResponse<Record<string, GrupoExtras[]>>> {
    const { data, error } = await supabase
      .from('modifier_groups')
      .select('id, product_id, name, min_select, max_select, display_order, modifier_options(id, name, price, display_order, is_active, created_at)')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .order('display_order')
      .order('created_at');
    if (error) return { data: null, error: error.message };

    const porProducto: Record<string, GrupoExtras[]> = {};
    for (const g of data ?? []) {
      const opciones = ((g as any).modifier_options ?? [])
        .filter((o: any) => o.is_active)
        .sort((a: any, b: any) => a.display_order - b.display_order || a.created_at.localeCompare(b.created_at))
        .map((o: any) => ({ id: o.id, nombre: o.name, precio: Number(o.price) || 0 }));
      if (opciones.length === 0) continue;
      (porProducto[g.product_id] ??= []).push({
        id: g.id,
        nombre: g.name,
        minimo: g.min_select,
        maximo: g.max_select,
        opciones,
      });
    }
    return { data: porProducto, error: null };
  }

  async getGrupos(productId: string): Promise<ServiceResponse<GrupoDeExtras[]>> {
    const { data, error } = await supabase
      .from('modifier_groups')
      .select('*')
      .eq('product_id', productId)
      .order('display_order')
      .order('created_at');
    return { data, error: error?.message || null };
  }

  async getOpciones(groupIds: string[]): Promise<ServiceResponse<OpcionDeExtra[]>> {
    if (groupIds.length === 0) return { data: [], error: null };
    const { data, error } = await supabase
      .from('modifier_options')
      .select('*')
      .in('group_id', groupIds)
      .order('display_order')
      .order('created_at');
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
  /**
   * Copia un grupo con sus opciones a otros productos. Si el producto ya tiene
   * un grupo con el mismo nombre, lo reemplaza en vez de sumar otro: copiar dos
   * veces el mismo grupo dejaba las opciones repetidas en la carta.
   * Los pedidos ya hechos no se tocan: guardan sus extras por nombre y precio.
   */
  async copiarGrupoAProductos(
    grupo: GrupoDeExtras,
    opciones: OpcionDeExtra[],
    productIds: string[],
    tenantId: string
  ): Promise<ServiceResponse<number>> {
    const mismoNombre = (n: string) => n.trim().toLowerCase() === grupo.name.trim().toLowerCase();
    const { data: existentes, error: errExistentes } = await supabase
      .from('modifier_groups')
      .select('id, product_id, name')
      .in('product_id', productIds);
    if (errExistentes) return { data: 0, error: errExistentes.message };

    let copiados = 0;

    for (const productId of productIds) {
      const iguales = (existentes ?? []).filter((g) => g.product_id === productId && mismoNombre(g.name));
      const [aReemplazar, ...sobrantes] = iguales;

      if (sobrantes.length > 0) {
        const { error } = await supabase.from('modifier_groups').delete().in('id', sobrantes.map((g) => g.id));
        if (error) return { data: copiados, error: error.message };
      }

      let destinoId: string;
      if (aReemplazar) {
        const { error: errGrupo } = await supabase
          .from('modifier_groups')
          .update({ name: grupo.name, min_select: grupo.min_select, max_select: grupo.max_select, is_active: true })
          .eq('id', aReemplazar.id);
        if (errGrupo) return { data: copiados, error: errGrupo.message };
        const { error: errBorrar } = await supabase.from('modifier_options').delete().eq('group_id', aReemplazar.id);
        if (errBorrar) return { data: copiados, error: errBorrar.message };
        destinoId = aReemplazar.id;
      } else {
        const { data: nuevoGrupo, error: errGrupo } = await this.crearGrupo({
          tenant_id: tenantId,
          branch_id: grupo.branch_id,
          product_id: productId,
          name: grupo.name,
          min_select: grupo.min_select,
          max_select: grupo.max_select,
        });
        if (errGrupo || !nuevoGrupo) return { data: copiados, error: errGrupo || 'No se pudo copiar el grupo' };
        destinoId = nuevoGrupo.id;
      }

      if (opciones.length > 0) {
        const { error: errOpciones } = await supabase.from('modifier_options').insert(
          opciones.map((o) => ({
            tenant_id: tenantId,
            group_id: destinoId,
            name: o.name,
            price: o.price,
            display_order: o.display_order,
            is_active: o.is_active,
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
