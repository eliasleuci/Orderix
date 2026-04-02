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
}

export const tableService = new TableService();
