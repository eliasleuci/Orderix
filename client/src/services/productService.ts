import { supabase } from '../lib/supabase';
import { IProductService } from '../types/services';
import { ServiceResponse, Product, Category } from '../types/domain';

/** Catálogo y Venta pedían la lista de productos de nuevo en cada entrada a
 *  la pantalla (y Venta lo hace además al cambiar de sucursal), aunque nada
 *  hubiera cambiado. Un caché corto en memoria evita ese refetch repetido sin
 *  arriesgar mostrar datos viejos por mucho tiempo: cualquier alta, edición o
 *  borrado lo invalida al toque. */
const CACHE_TTL_MS = 30_000;

/**
 * Las fotos se guardan en base64 dentro de la fila. Con `select('*')` Catálogo
 * y Venta bajaban la foto completa (hasta 1400px) de cada producto y categoría
 * para mostrar una tarjeta: varios megas antes de pintar la pantalla. Las
 * listas traen sólo la miniatura, que es lo único que se muestra.
 */
const COLUMNAS_PRODUCTO =
  'id, tenant_id, branch_id, category_id, name, description, price, is_active, created_at, thumbnail_url, categories(id, name)';
const COLUMNAS_CATEGORIA = 'id, name, tenant_id, display_order, is_active, show_in_carta, thumbnail_url';

/**
 * Las filas cargadas antes de que existieran las miniaturas no tienen una: a
 * esas (y sólo a esas) se les trae la foto original para no mostrarlas vacías.
 */
async function completarSinMiniatura<T extends { id: string; thumbnail_url?: string | null; image_url?: string | null }>(
  tabla: 'products' | 'categories',
  filas: T[]
): Promise<T[]> {
  const ids = filas.filter((f) => !f.thumbnail_url).map((f) => f.id);
  if (ids.length === 0) return filas;
  const { data } = await supabase.from(tabla).select('id, image_url').in('id', ids).not('image_url', 'is', null);
  const original = new Map((data ?? []).map((f: any) => [f.id, f.image_url as string]));
  return filas.map((f) => (original.has(f.id) ? { ...f, image_url: original.get(f.id) } : f));
}

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
      .select(COLUMNAS_PRODUCTO)
      .eq('branch_id', branchId);

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data: filas, error } = await query;
    if (error) return { data: null, error: error.message };

    const data = (await completarSinMiniatura('products', (filas ?? []) as any[])) as Product[];
    this.cache.set(cacheKey, { data, ts: Date.now() });
    return { data, error: null };
  }

  async getCategories(): Promise<ServiceResponse<Category[]>> {
    const { data: filas, error } = await supabase
      .from('categories')
      .select(COLUMNAS_CATEGORIA)
      .order('display_order');
    if (error) return { data: null, error: error.message };

    return { data: await completarSinMiniatura('categories', (filas ?? []) as Category[]), error: null };
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
