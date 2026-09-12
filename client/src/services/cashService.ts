import { baseApi } from './api';
import { ServiceResponse } from '../types/domain';

export interface Caja {
  id: string;
  estado: 'OPEN' | 'CLOSED';
  montoInicial: number;
  montoContado: number | null;
  ventasEfectivo: number | null;
  montoEsperado: number | null;
  diferencia: number | null;
  notasApertura: string | null;
  notasCierre: string | null;
  abiertaEn: string;
  cerradaEn: string | null;
  abiertaPor: string | null;
  cerradaPor: string | null;
}

export interface ResumenCaja {
  ventasEfectivo: number;
  ventasElectronicas: number;
  cantidadPedidos: number;
  sinCobrar: { total: number; cantidad: number };
}

const fallo = (e: any, porDefecto: string) => e?.response?.data?.message || porDefecto;

class CashService {
  async getActual(): Promise<ServiceResponse<{ caja: Caja | null; resumen: ResumenCaja | null }>> {
    try {
      const { data } = await baseApi.get('/cash/actual');
      return { data: data.data, error: null };
    } catch (e) {
      return { data: null, error: fallo(e, 'No se pudo consultar la caja') };
    }
  }

  async abrir(montoInicial: number, notas?: string): Promise<ServiceResponse<Caja>> {
    try {
      const { data } = await baseApi.post('/cash/abrir', { montoInicial, notas: notas || null });
      return { data: data.data.caja, error: null };
    } catch (e) {
      return { data: null, error: fallo(e, 'No se pudo abrir la caja') };
    }
  }

  async cerrar(
    montoContado: number,
    notas?: string
  ): Promise<ServiceResponse<{ caja: Caja; resumen: ResumenCaja }>> {
    try {
      const { data } = await baseApi.post('/cash/cerrar', { montoContado, notas: notas || null });
      return { data: data.data, error: null };
    } catch (e) {
      return { data: null, error: fallo(e, 'No se pudo cerrar la caja') };
    }
  }

  async getHistorial(): Promise<ServiceResponse<Caja[]>> {
    try {
      const { data } = await baseApi.get('/cash/historial');
      return { data: data.data.turnos, error: null };
    } catch (e) {
      return { data: null, error: fallo(e, 'No se pudo cargar el historial') };
    }
  }
}

export const cashService = new CashService();
