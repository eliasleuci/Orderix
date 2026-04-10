import { supabase } from '../lib/supabase';
import { IProductService } from '../types/services';
import { ServiceResponse, Product, Category } from '../types/domain';

class ProductService implements IProductService {
  async getBranchProducts(branchId: string, includeInactive = false): Promise<ServiceResponse<Product[]>> {
    let query = supabase
      .from('products')
      .select('*, categories(*)')
      .eq('branch_id', branchId);
      
    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    return { data, error: error?.message || null };
  }

  async getCategories(): Promise<ServiceResponse<Category[]>> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');

    return { data, error: error?.message || null };
  }

  async createProduct(product: Partial<Product>): Promise<ServiceResponse<Product>> {
    const { data, error } = await supabase.from('products').insert([product]).select().single();
    return { data, error: error?.message || null };
  }

  async updateProduct(id: string, updates: Partial<Product>): Promise<ServiceResponse<Product>> {
    const { data, error } = await supabase.from('products').update(updates).eq('id', id).select().single();
    return { data, error: error?.message || null };
  }

  async deleteProduct(id: string): Promise<ServiceResponse<boolean>> {
    const { error } = await supabase.from('products').delete().eq('id', id);
    return { data: !error, error: error?.message || null };
  }

  async createCategory(name: string, tenantId?: string): Promise<ServiceResponse<Category>> {
    const { data, error } = await supabase
      .from('categories')
      .insert([{ 
        name: name.trim().toUpperCase(),
        tenant_id: tenantId 
      }])
      .select()
      .single();
    return { data, error: error?.message || null };
  }
}

export const productService = new ProductService();
