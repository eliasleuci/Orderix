import { supabase } from '../lib/supabase';
import { ServiceResponse } from '../types/domain';

export type TableStatus = 'FREE' | 'OCCUPIED' | 'RESERVED';

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

  async occupyTable(id: string, customerName?: string, notes?: string): Promise<ServiceResponse<Table>> {
    return this.updateTable(id, {
      status: 'OCCUPIED',
      customer_name: customerName || null,
      notes: notes || null,
      opened_at: new Date().toISOString(),
    });
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
      opened_at: null,
    });
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
