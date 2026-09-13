import { supabase } from '../lib/supabase';
import { ServiceResponse } from '../types/domain';

export type TableStatus = 'FREE' | 'OCCUPIED' | 'RESERVED';

export interface ConsumoMesa {
  total: number;
  pedidos: any[];
}

export interface Mozo {
  id: string;
  branch_id: string;
  name: string;
  phone: string | null;
  /** Porcentaje sobre la venta que cobra el mozo. */
  commission_pct: number;
  is_active: boolean;
}

export interface Table {
  id: string;
  branch_id: string;
  number: number;
  label: string;
  capacity: number;
  status: TableStatus;
  customer_name?: string | null;
  notes?: string | null;
  opened_at?: string | null;
  waiter_id?: string | null;
  parent_table_id?: string | null;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

class TableService {
  async getBranchTables(branchId: string): Promise<ServiceResponse<Table[]>> {
    const { data, error } = await supabase
      .from('tables')
      .select('*')
      .eq('branch_id', branchId)
      .order('number', { ascending: true });
    return { data, error: error?.message || null };
  }

  async createTable(table: Partial<Table>): Promise<ServiceResponse<Table>> {
    const { data, error } = await supabase
      .from('tables')
      .insert([table])
      .select()
      .single();
    return { data, error: error?.message || null };
  }

  async updateTable(id: string, updates: Partial<Table>): Promise<ServiceResponse<Table>> {
    const { data, error } = await supabase
      .from('tables')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return { data, error: error?.message || null };
  }

  /**
   * Abre la mesa desde cero: pisa cliente, observaciones y mozo con lo que se
   * le pase. Es lo correcto al abrirla, pero NO sirve para agregarle un pedido
   * a una mesa que ya está abierta; para eso está marcarOcupada.
   */
  async occupyTable(
    id: string,
    customerName?: string,
    notes?: string,
    waiterId?: string | null
  ): Promise<ServiceResponse<Table>> {
    return this.updateTable(id, {
      status: 'OCCUPIED',
      customer_name: customerName || null,
      notes: notes || null,
      waiter_id: waiterId || null,
      opened_at: new Date().toISOString(),
    });
  }

  /**
   * Marca la mesa ocupada sin tocar nada más de lo necesario.
   *
   * El POS llamaba a occupyTable con dos argumentos al confirmar cada pedido, y
   * como esa función escribe la fila entera, le borraba el mozo asignado y las
   * observaciones, y le reseteaba la hora de apertura: una mesa abierta a las
   * 21:00 con tres pedidos figuraba abierta desde el último. El nombre del
   * cliente sólo se escribe si viene y si la mesa no tenía uno.
   */
  async marcarOcupada(
    id: string,
    customerName?: string,
    waiterId?: string | null
  ): Promise<ServiceResponse<Table>> {
    const cambios: Partial<Table> = { status: 'OCCUPIED' };

    const { data: actual } = await supabase
      .from('tables')
      .select('customer_name, opened_at, waiter_id')
      .eq('id', id)
      .maybeSingle();

    if (customerName && !actual?.customer_name) cambios.customer_name = customerName;
    if (!actual?.opened_at) cambios.opened_at = new Date().toISOString();
    // El mozo sólo se escribe si la mesa no tenía uno: quien ya está atendiendo
    // no se pisa porque desde la caja eligieron otro en el desplegable.
    if (waiterId && !actual?.waiter_id) cambios.waiter_id = waiterId;

    return this.updateTable(id, cambios);
  }

  async reserveTable(id: string, customerName?: string, notes?: string): Promise<ServiceResponse<Table>> {
    return this.updateTable(id, {
      status: 'RESERVED',
      customer_name: customerName || null,
      notes: notes || null,
      opened_at: null,
    });
  }

  async freeTable(id: string): Promise<ServiceResponse<Table>> {
    return this.updateTable(id, {
      status: 'FREE',
      customer_name: null,
      notes: null,
      // El mozo se limpia con la mesa: si no, la próxima que la abra arrancaría
      // con el del turno anterior ya puesto.
      waiter_id: null,
      opened_at: null,
    });
  }

  async getMozos(branchId: string, incluirInactivos = false): Promise<ServiceResponse<Mozo[]>> {
    let query = supabase.from('waiters').select('*').eq('branch_id', branchId).order('name');
    if (!incluirInactivos) query = query.eq('is_active', true);

    const { data, error } = await query;
    return { data, error: error?.message || null };
  }

  async crearMozo(m: {
    tenant_id: string;
    branch_id: string;
    name: string;
    phone: string | null;
    commission_pct: number;
  }): Promise<ServiceResponse<Mozo>> {
    const { data, error } = await supabase.from('waiters').insert([m]).select().single();
    return { data, error: error?.message || null };
  }

  /**
   * La baja de un mozo que se fue del local: is_active en false. Deja de
   * aparecer al abrir una mesa, pero sus ventas siguen atribuidas a él.
   */
  async actualizarMozo(id: string, cambios: Partial<Mozo>): Promise<ServiceResponse<Mozo>> {
    const { data, error } = await supabase
      .from('waiters')
      .update(cambios)
      .eq('id', id)
      .select()
      .single();
    return { data, error: error?.message || null };
  }

  /**
   * Cuántos pedidos tiene atribuidos un mozo. Se consulta antes de borrarlo:
   * orders.waiter_id está con ON DELETE SET NULL, así que borrar a uno que ya
   * vendió le arrancaría la atribución a todo su historial de comisiones.
   */
  async contarVentasDeMozo(id: string): Promise<ServiceResponse<number>> {
    const { count, error } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('waiter_id', id);
    return { data: count ?? 0, error: error?.message || null };
  }

  /**
   * Borrado definitivo. Sólo tiene sentido para un mozo que nunca vendió nada
   * -uno cargado por error, repetido o de prueba-. Para el que se fue del local
   * está la pausa, que conserva el historial. La pantalla verifica las ventas
   * antes de llamar acá.
   */
  async eliminarMozo(id: string): Promise<ServiceResponse<boolean>> {
    const { error } = await supabase.from('waiters').delete().eq('id', id);
    return { data: !error, error: error?.message || null };
  }


  async deleteTable(id: string): Promise<ServiceResponse<boolean>> {
    const { error } = await supabase.from('tables').delete().eq('id', id);
    return { data: !error, error: error?.message || null };
  }

  // --- DINE-IN ENHANCEMENTS ---

  async joinTable(childId: string, parentId: string | null): Promise<ServiceResponse<Table>> {
    // If linking, table is marked OCCUPIED. If unlinking, it stays however it is (usually freed when paid).
    return this.updateTable(childId, {
      parent_table_id: parentId,
      status: parentId ? 'OCCUPIED' : undefined
    });
  }

  async getTableBill(tableId: string): Promise<ServiceResponse<{ orders: any[], total: number }>> {
    const { data: children } = await supabase.from('tables').select('id').eq('parent_table_id', tableId);
    const tableIds = [tableId, ...(children?.map(c => c.id) || [])];

    // Fetch all unpaid orders for this table group
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*, products(*))')
      .in('table_id', tableIds)
      .eq('payment_method', 'UNPAID')
      .order('created_at', { ascending: true });

    if (error) return { data: null, error: error.message };

    const total = (data || []).reduce((acc, order) => acc + Number(order.total), 0);
    return { data: { orders: data || [], total }, error: null };
  }

  /**
   * Lo que se está consumiendo en cada mesa abierta de la sucursal, en UNA sola
   * consulta. Pedir la cuenta mesa por mesa con getTableBill serían dos
   * consultas por mesa cada vez que se refresca el salón.
   *
   * La clave del mapa es la mesa a la que se le cargó el pedido; las mesas
   * unidas se resuelven en la pantalla, que es la que conoce el parentesco.
   */
  async getConsumoAbierto(branchId: string): Promise<ServiceResponse<Record<string, ConsumoMesa>>> {
    const { data, error } = await supabase
      .from('orders')
      .select('id, table_id, total, created_at, order_items(id, quantity, unit_price, notes, products(name))')
      .eq('branch_id', branchId)
      .eq('payment_method', 'UNPAID')
      .not('table_id', 'is', null)
      .order('created_at', { ascending: true });

    if (error) return { data: null, error: error.message };

    const porMesa: Record<string, ConsumoMesa> = {};
    for (const o of data ?? []) {
      const mesa = o.table_id as string;
      if (!porMesa[mesa]) porMesa[mesa] = { total: 0, pedidos: [] };
      porMesa[mesa].total += Number(o.total ?? 0);
      porMesa[mesa].pedidos.push(o);
    }

    return { data: porMesa, error: null };
  }

  async closeTableBill(tableId: string, paymentMethod: string): Promise<ServiceResponse<{ closed_count: number }>> {
    const { data, error } = await supabase.rpc('close_table_bill', {
      p_table_id: tableId,
      p_payment_method: paymentMethod
    });
    
    if (error) return { data: null, error: error.message };
    return { data: { closed_count: data?.orders_closed || 0 }, error: null };
  }
}

export const tableService = new TableService();
