import { supabase } from '../lib/supabase';
import { ServiceResponse } from '../types/domain';

export interface ZonaEnvio {
  id: string;
  branch_id: string;
  name: string;
  price: number;
  is_active: boolean;
}

export interface Repartidor {
  id: string;
  branch_id: string;
  name: string;
  phone: string | null;
  is_active: boolean;
}

export interface ConfigEnvio {
  branch_id: string;
  /** Si está apagado, el POS ni ofrece el tipo de pedido Envío. */
  delivery_enabled: boolean;
  km_enabled: boolean;
  km_base_price: number;
  km_price: number;
}

/** Precio de un envío por distancia: una base fija más el precio de cada km. */
export const calcularPrecioPorKm = (config: ConfigEnvio, km: number): number => {
  if (!Number.isFinite(km) || km < 0) return 0;
  return Math.round((Number(config.km_base_price) + Number(config.km_price) * km) * 100) / 100;
};

class DeliveryService {
  async getZonas(branchId: string, incluirInactivas = false): Promise<ServiceResponse<ZonaEnvio[]>> {
    let query = supabase.from('delivery_zones').select('*').eq('branch_id', branchId).order('name');
    if (!incluirInactivas) query = query.eq('is_active', true);

    const { data, error } = await query;
    return { data, error: error?.message || null };
  }

  async crearZona(zona: {
    tenant_id: string;
    branch_id: string;
    name: string;
    price: number;
  }): Promise<ServiceResponse<ZonaEnvio>> {
    const { data, error } = await supabase.from('delivery_zones').insert([zona]).select().single();
    return { data, error: error?.message || null };
  }

  async actualizarZona(id: string, cambios: Partial<ZonaEnvio>): Promise<ServiceResponse<ZonaEnvio>> {
    const { data, error } = await supabase
      .from('delivery_zones')
      .update(cambios)
      .eq('id', id)
      .select()
      .single();
    return { data, error: error?.message || null };
  }

  async borrarZona(id: string): Promise<ServiceResponse<boolean>> {
    const { error } = await supabase.from('delivery_zones').delete().eq('id', id);
    return { data: !error, error: error?.message || null };
  }

  async getRepartidores(branchId: string, incluirInactivos = false): Promise<ServiceResponse<Repartidor[]>> {
    let query = supabase.from('delivery_drivers').select('*').eq('branch_id', branchId).order('name');
    if (!incluirInactivos) query = query.eq('is_active', true);

    const { data, error } = await query;
    return { data, error: error?.message || null };
  }

  async crearRepartidor(r: {
    tenant_id: string;
    branch_id: string;
    name: string;
    phone: string | null;
  }): Promise<ServiceResponse<Repartidor>> {
    const { data, error } = await supabase.from('delivery_drivers').insert([r]).select().single();
    return { data, error: error?.message || null };
  }

  async actualizarRepartidor(id: string, cambios: Partial<Repartidor>): Promise<ServiceResponse<Repartidor>> {
    const { data, error } = await supabase
      .from('delivery_drivers')
      .update(cambios)
      .eq('id', id)
      .select()
      .single();
    return { data, error: error?.message || null };
  }

  async borrarRepartidor(id: string): Promise<ServiceResponse<boolean>> {
    const { error } = await supabase.from('delivery_drivers').delete().eq('id', id);
    return { data: !error, error: error?.message || null };
  }

  /**
   * La fila de configuración se crea recién cuando el local la guarda por
   * primera vez, así que su ausencia es normal: se devuelve el cobro por km
   * apagado en vez de un error.
   */
  async getConfig(branchId: string): Promise<ServiceResponse<ConfigEnvio>> {
    const { data, error } = await supabase
      .from('delivery_settings')
      .select('*')
      .eq('branch_id', branchId)
      .maybeSingle();

    if (error) return { data: null, error: error.message };

    // Fail-open en delivery_enabled: una sucursal sin fila de configuración
    // tiene que seguir vendiendo por envío como hasta ahora. Apagarlo es una
    // decisión explícita del dueño, no algo que pase por no haber guardado.
    return {
      data: data
        ? { ...data, delivery_enabled: data.delivery_enabled !== false }
        : { branch_id: branchId, delivery_enabled: true, km_enabled: false, km_base_price: 0, km_price: 0 },
      error: null,
    };
  }

  async guardarConfig(config: ConfigEnvio & { tenant_id: string }): Promise<ServiceResponse<ConfigEnvio>> {
    const { data, error } = await supabase
      .from('delivery_settings')
      .upsert(
        {
          branch_id: config.branch_id,
          tenant_id: config.tenant_id,
          delivery_enabled: config.delivery_enabled,
          km_enabled: config.km_enabled,
          km_base_price: config.km_base_price,
          km_price: config.km_price,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'branch_id' }
      )
      .select()
      .single();

    return { data, error: error?.message || null };
  }

  async asignarRepartidor(orderId: string, driverId: string | null): Promise<ServiceResponse<boolean>> {
    const { error } = await supabase
      .from('orders')
      .update({ delivery_driver_id: driverId, updated_at: new Date().toISOString() })
      .eq('id', orderId);

    return { data: !error, error: error?.message || null };
  }
}

export const deliveryService = new DeliveryService();
