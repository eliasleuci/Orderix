import { supabase } from '../lib/supabase';
import { IProductService } from '../types/services';
import { ServiceResponse, Product, Category } from '../types/domain';

/** Catálogo y Venta pedían la lista de productos de nuevo en cada entrada a
 *  la pantalla (y Venta lo hace además al cambiar de sucursal), aunque nada
 *  hubiera cambiado. Un caché corto en memoria evita ese refetch repetido sin
 *  arriesgar mostrar datos viejos por mucho tiempo: cualquier alta, edición o
 *  borrado lo invalida al toque. */
const CACHE_TTL_MS = 30_000;

class ProductService implements IProductService {
  private cache = new Map<string, { data: Product[]; ts: number }>();

  private invalidarCache() {
    this.cache.clear();
  }

  async getBranchProducts(branchId: string, includeInactive = false): Promise<ServiceResponse<Product[]>> {
    const cacheKey = `${branchId}:${includeInactive}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return { data: cached.data, error: null };
    }

    let query = supabase
      .from('products')
      .select('*, categories(*)')
      .eq('branch_id', branchId);

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (!error && data) {
      this.cache.set(cacheKey, { data, ts: Date.now() });
    }
    return { data, error: error?.message || null };
  }

  async getCategories(): Promise<ServiceResponse<Category[]>> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('display_order');

    return { data, error: error?.message || null };
  }

  async createProduct(product: Partial<Product>): Promise<ServiceResponse<Product>> {
    const { data, error } = await supabase.from('products').insert([product]).select().single();
    if (!error) this.invalidarCache();
    return { data, error: error?.message || null };
  }

  async updateProduct(id: string, updates: Partial<Product>): Promise<ServiceResponse<Product>> {
    const { data, error } = await supabase.from('products').update(updates).eq('id', id).select().single();
    if (!error) this.invalidarCache();
    return { data, error: error?.message || null };
  }

  async deleteProduct(id: string): Promise<ServiceResponse<boolean>> {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (!error) this.invalidarCache();
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

  async updateCategory(id: string, cambios: Partial<Category>): Promise<ServiceResponse<Category>> {
    const { data, error } = await supabase
      .from('categories')
      .update(cambios)
      .eq('id', id)
      .select()
      .single();
    if (!error) this.invalidarCache();
    return { data, error: error?.message || null };
  }

  /**
   * Una categoría con productos no se puede borrar: la base la protege (el
   * producto no puede quedar apuntando a una categoría inexistente). Se
   * traduce el error crudo de Postgres en algo que tenga sentido para quien
   * está gestionando el menú.
   */
  async deleteCategory(id: string): Promise<ServiceResponse<boolean>> {
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error?.code === '23503') {
      return { data: null, error: 'Esta categoría tiene productos. Movelos a otra categoría o pausala en vez de borrarla.' };
    }
    if (!error) this.invalidarCache();
    return { data: !error, error: error?.message || null };
  }
}

export const productService = new ProductService();
