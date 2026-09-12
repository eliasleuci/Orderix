import { baseApi } from './api';
import { ServiceResponse } from '../types/domain';

export interface ProductoCarta {
  id: string;
  nombre: string;
  precio: number;
  imagen: string | null;
}

export interface CategoriaCarta {
  id: string;
  nombre: string;
  productos: ProductoCarta[];
}

export interface Carta {
  local: { nombre: string; slug: string };
  sucursalActual: { id: string; nombre: string; direccion: string | null; telefono: string | null };
  sucursales: Array<{ id: string; nombre: string }>;
  categorias: CategoriaCarta[];
}

export interface EnlaceCarta {
  slug: string;
  nombre: string;
  sucursales: Array<{ id: string; nombre: string }>;
}

class MenuService {
  async getCartaPublica(slug: string, sucursalId?: string): Promise<ServiceResponse<Carta>> {
    try {
      const { data } = await baseApi.get(`/menu/publico/${encodeURIComponent(slug)}`, {
        params: sucursalId ? { sucursal: sucursalId } : undefined,
      });
      return { data: data.data, error: null };
    } catch (e: any) {
      return { data: null, error: e?.response?.data?.message || 'No se pudo cargar la carta' };
    }
  }

  async getEnlace(): Promise<ServiceResponse<EnlaceCarta>> {
    try {
      const { data } = await baseApi.get('/menu/enlace');
      return { data: data.data, error: null };
    } catch (e: any) {
      return { data: null, error: e?.response?.data?.message || 'No se pudo obtener el enlace' };
    }
  }
}

export const menuService = new MenuService();
