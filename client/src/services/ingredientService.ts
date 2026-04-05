import { supabase } from '../lib/supabase';
import { IIngredientService } from '../types/services';
import { ServiceResponse, Ingredient, IngredientCategory } from '../types/domain';

class IngredientService implements IIngredientService {
  async getBranchStock(): Promise<ServiceResponse<Ingredient[]>> {
    try {
      const { data, error } = await supabase
        .from('ingredients')
        .select('*, category:ingredient_categories(*)')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return { data: data || [], error: null };
    } catch (err: any) {
      console.error('Error fetching ingredients:', err);
      return { data: null, error: err.message || 'Error al cargar ingredientes' };
    }
  }

  async createIngredient(data: { name: string; unit: string; stock: number; minStock: number; categoryId?: string }): Promise<ServiceResponse<Ingredient>> {
    try {
      const { data: result, error } = await supabase
        .from('ingredients')
        .insert({
          name: data.name,
          unit: data.unit,
          stock: data.stock,
          min_stock: data.minStock,
          category_id: data.categoryId || null,
          is_active: true
        })
        .select()
        .single();
      
      if (error) throw error;
      return { data: result as Ingredient, error: null };
    } catch (err: any) {
      console.error('Error creating ingredient:', err);
      return { data: null, error: err.message || 'Error al crear ingrediente' };
    }
  }

  async deleteIngredient(id: string): Promise<ServiceResponse<boolean>> {
    try {
      console.log('Intentando eliminar:', id);
      const { data, error, status } = await supabase
        .from('ingredients')
        .update({ is_active: false })
        .eq('id', id)
        .select();
      
      console.log('Delete full result:', { data, error, status });
      if (error) throw error;
      return { data: true, error: null };
    } catch (err: any) {
      console.error('Error deleting ingredient:', err);
      return { data: false, error: err.message || 'Error al eliminar ingrediente' };
    }
  }

  async updateStock(id: string, newStock: number, reason?: string): Promise<ServiceResponse<Ingredient>> {
    try {
      const { error } = await supabase
        .from('ingredients')
        .update({ stock: newStock })
        .eq('id', id);
      
      if (error) throw error;
      return { data: { id, stock: newStock } as Ingredient, error: null };
    } catch (err: any) {
      console.error('Error updating stock:', err);
      return { data: null, error: err.message || 'Error al actualizar stock' };
    }
  }

  async getCategories(): Promise<ServiceResponse<IngredientCategory[]>> {
    try {
      const { data, error } = await supabase
        .from('ingredient_categories')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return { data: data || [], error: null };
    } catch (err: any) {
      console.error('Error fetching categories:', err);
      return { data: null, error: err.message || 'Error al cargar categorías' };
    }
  }

  async createCategory(name: string): Promise<ServiceResponse<IngredientCategory>> {
    try {
      const { data, error } = await supabase
        .from('ingredient_categories')
        .insert({ name })
        .select()
        .single();
      
      if (error) throw error;
      return { data: data as IngredientCategory, error: null };
    } catch (err: any) {
      console.error('Error creating category:', err);
      return { data: null, error: err.message || 'Error al crear categoría' };
    }
  }

  async getMovements(branchId: string, startDate?: string, endDate?: string): Promise<ServiceResponse<any[]>> {
    try {
      let query = supabase
        .from('stock_movements')
        .select('*, ingredient:ingredients(name, unit), user:profiles(name, email)')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (startDate) {
        query = query.gte('created_at', startDate);
      }
      if (endDate) {
        query = query.lte('created_at', endDate);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return { data: data || [], error: null };
    } catch (err: any) {
      console.error('Error fetching movements:', err);
      return { data: null, error: err.message || 'Error al cargar movimientos' };
    }
  }

  async getReport(branchId: string): Promise<ServiceResponse<any>> {
    try {
      const { data: ingredients, error } = await supabase.rpc('get_ingredients');
      if (error) throw error;
      
      const total = ingredients?.length || 0;
      const okCount = ingredients?.filter((i: any) => i.stock > i.min_stock).length || 0;
      const lowCount = ingredients?.filter((i: any) => i.stock > 0 && i.stock <= i.min_stock).length || 0;
      const outCount = ingredients?.filter((i: any) => i.stock === 0).length || 0;
      
      const lowStockItems = ingredients
        ?.filter((i: any) => i.stock <= i.min_stock)
        .sort((a: any, b: any) => (a.stock - a.min_stock) - (b.stock - b.min_stock))
        .slice(0, 10)
        .map((i: any) => ({
          name: i.name,
          stock: i.stock,
          minStock: i.min_stock,
          deficit: Math.max(0, i.min_stock - i.stock),
          unit: i.unit,
          status: i.stock === 0 ? 'out' : 'low'
        })) || [];
      
      return {
        data: {
          summary: { total, okCount, lowCount, outCount },
          lowStockItems,
          consumptionByType: {}
        },
        error: null
      };
    } catch (err: any) {
      console.error('Error fetching report:', err);
      return { data: null, error: err.message || 'Error al cargar reporte' };
    }
  }
}

export const ingredientService = new IngredientService();
