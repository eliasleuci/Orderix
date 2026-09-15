import { baseApi, API_URL } from './api';
import { supabase } from '../lib/supabase';
import { ServiceResponse } from '../types/domain';

export interface OpcionExtra {
  id: string;
  nombre: string;
  precio: number;
}

export interface GrupoExtras {
  id: string;
  nombre: string;
  minimo: number;
  /** null = sin techo (checkbox libre). 1 = elegir una sola (radio). */
  maximo: number | null;
  opciones: OpcionExtra[];
}

export interface ProductoVidriera {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  imagen: string | null;
  ingredientes: string[];
  grupos: GrupoExtras[];
}

export interface CategoriaVidriera {
  id: string;
  nombre: string;
  imagen: string | null;
  productos: ProductoVidriera[];
}

export interface ConfigPedidos {
  habilitado: boolean;
  pausado: boolean;
  whatsapp: string | null;
  minimo: number;
  aceptaEfectivo: boolean;
  aceptaTransferencia: boolean;
  datosTransferencia: string | null;
  permiteRetiro: boolean;
  permiteEnvio: boolean;
  minutosPreparacion: number | null;
}

export interface ZonaVidriera {
  id: string;
  nombre: string;
  precio: number;
}

export interface Vidriera {
  local: { nombre: string; slug: string };
  sucursalActual: { id: string; nombre: string; direccion: string | null; telefono: string | null };
  sucursales: Array<{ id: string; nombre: string }>;
  pedidos: ConfigPedidos;
  zonas: ZonaVidriera[];
  categorias: CategoriaVidriera[];
}

export interface ItemPedidoWeb {
  id: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  notas: string | null;
  extras: { label: string; price: number }[];
}

export interface PedidoWeb {
  id: string;
  codigo: number;
  estado: 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'EXPIRED';
  cliente: string;
  telefono: string;
  direccion: string | null;
  ubicacion: { lat: number; lng: number } | null;
  tipo: 'DELIVERY' | 'TAKEAWAY';
  formaDePago: 'CASH' | 'TRANSFER';
  zona: string | null;
  notas: string | null;
  totalProductos: number;
  costoEnvio: number;
  total: number;
  creadoEn: string;
  confirmadoEn: string | null;
  motivoRechazo: string | null;
  orderId: string | null;
  items: ItemPedidoWeb[];
}

export interface NuevoPedido {
  idempotencyKey: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string | null;
  customerLat?: number | null;
  customerLng?: number | null;
  orderType: 'DELIVERY' | 'TAKEAWAY';
  paymentMethod: 'CASH' | 'TRANSFER';
  deliveryZoneId?: string | null;
  notes?: string | null;
  items: Array<{
    productId: string;
    quantity: number;
    notes?: string | null;
    modifierOptionIds?: string[];
  }>;
}

export type ResultadoConfirmar =
  | { estado: 'confirmado'; orderId: string; total: number; advertencias: any[] }
  | { estado: 'precio_cambiado'; cambios: any[]; totalHoy: number }
  | { estado: 'productos_no_disponibles'; faltantes: any[] };

const fallo = (e: any, porDefecto: string) => e?.response?.data?.message || porDefecto;

/**
 * El backend devuelve la foto de cada producto como una ruta suya
 * ("/webshop/publico/..."), no como la imagen embebida. Acá se le antepone la
 * base del backend, que en desarrollo vive en otro puerto.
 */
const absoluta = (ruta: string | null) =>
  ruta?.startsWith('/webshop/') ? `${API_URL}${ruta}` : ruta;

const conImagenesAbsolutas = (vidriera: Vidriera): Vidriera => ({
  ...vidriera,
  categorias: vidriera.categorias.map((c) => ({
    ...c,
    imagen: absoluta(c.imagen),
    productos: c.productos.map((p) => ({ ...p, imagen: absoluta(p.imagen) })),
  })),
});

class WebshopService {
  async getVidriera(
    slug: string,
    sucursalId?: string,
    modo: 'carta' | 'pedidos' = 'pedidos'
  ): Promise<ServiceResponse<Vidriera>> {
    try {
      const { data } = await baseApi.get(`/webshop/publico/${encodeURIComponent(slug)}`, {
        params: { ...(sucursalId ? { sucursal: sucursalId } : {}), modo },
      });
      return { data: conImagenesAbsolutas(data.data), error: null };
    } catch (e) {
      return { data: null, error: fallo(e, 'No se pudo cargar la carta') };
    }
  }

  async enviarPedido(
    slug: string,
    sucursalId: string | undefined,
    pedido: NuevoPedido
  ): Promise<ServiceResponse<{ pedido: PedidoWeb; repetido: boolean }>> {
    try {
      const { data } = await baseApi.post(
        `/webshop/publico/${encodeURIComponent(slug)}/pedido`,
        pedido,
        { params: sucursalId ? { sucursal: sucursalId } : undefined }
      );
      return { data: data.data, error: null };
    } catch (e) {
      return { data: null, error: fallo(e, 'No se pudo enviar el pedido') };
    }
  }

  async getBandeja(historial = false): Promise<ServiceResponse<PedidoWeb[]>> {
    try {
      const { data } = await baseApi.get('/webshop/pedidos', {
        params: historial ? { historial: 'true' } : undefined,
      });
      return { data: data.data.pedidos, error: null };
    } catch (e) {
      return { data: null, error: fallo(e, 'No se pudieron cargar los pedidos') };
    }
  }

  async confirmar(id: string, aceptarCambioDePrecio = false): Promise<ServiceResponse<ResultadoConfirmar>> {
    try {
      const { data } = await baseApi.post(`/webshop/pedidos/${id}/confirmar`, { aceptarCambioDePrecio });
      return { data: data.data, error: null };
    } catch (e) {
      return { data: null, error: fallo(e, 'No se pudo confirmar el pedido') };
    }
  }

  async rechazar(id: string, motivo?: string): Promise<ServiceResponse<boolean>> {
    try {
      await baseApi.post(`/webshop/pedidos/${id}/rechazar`, { motivo: motivo || null });
      return { data: true, error: null };
    } catch (e) {
      return { data: null, error: fallo(e, 'No se pudo rechazar el pedido') };
    }
  }
}

export interface ConfigWeb {
  branch_id: string;
  enabled: boolean;
  paused: boolean;
  whatsapp_phone: string | null;
  min_order: number;
  accepts_cash: boolean;
  accepts_transfer: boolean;
  transfer_info: string | null;
  takeaway_enabled: boolean;
  prep_minutes: number | null;
}

/**
 * La configuración va directo a Supabase y no por Express: la política de la
 * migración 022 ya deja leerla a la sucursal y escribirla sólo al dueño, así
 * que un endpoint más sólo repetiría ese control.
 */
export const webConfigService = {
  async get(branchId: string): Promise<ServiceResponse<ConfigWeb>> {
    const { data, error } = await supabase
      .from('web_settings')
      .select('*')
      .eq('branch_id', branchId)
      .maybeSingle();

    if (error) return { data: null, error: error.message };

    return {
      data: data ?? {
        branch_id: branchId,
        enabled: false,
        paused: false,
        whatsapp_phone: null,
        min_order: 0,
        accepts_cash: true,
        accepts_transfer: false,
        transfer_info: null,
        takeaway_enabled: true,
        prep_minutes: null,
      },
      error: null,
    };
  },

  async guardar(config: ConfigWeb & { tenant_id: string }): Promise<ServiceResponse<ConfigWeb>> {
    const { data, error } = await supabase
      .from('web_settings')
      .upsert(
        {
          branch_id: config.branch_id,
          tenant_id: config.tenant_id,
          enabled: config.enabled,
          paused: config.paused,
          // Sólo dígitos: es lo que necesita el link de wa.me, y la base tiene
          // un CHECK que rechaza cualquier otra cosa.
          whatsapp_phone: config.whatsapp_phone?.replace(/\D/g, '') || null,
          min_order: config.min_order,
          accepts_cash: config.accepts_cash,
          accepts_transfer: config.accepts_transfer,
          transfer_info: config.transfer_info || null,
          takeaway_enabled: config.takeaway_enabled,
          prep_minutes: config.prep_minutes,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'branch_id' }
      )
      .select()
      .single();

    return { data, error: error?.message || null };
  },
};

export const webshopService = new WebshopService();

/**
 * Arma el mensaje que el cliente manda por WhatsApp.
 *
 * El pedido ya quedó guardado antes de llegar acá: si el cliente nunca manda el
 * mensaje, el local igual lo tiene en pantalla. Esto sólo abre la conversación.
 *
 * Sin emoji a propósito: los que se usaban (📍 💵 🏦 📝) están fuera del plano
 * básico de Unicode y en varios WhatsApp aparecían como un cuadradito roto. El
 * texto plano se ve igual en cualquier teléfono.
 */
export const mensajeDeWhatsapp = (pedido: PedidoWeb, local: string): string => {
  const plata = (n: number) => `$${n.toLocaleString('es-AR')}`;
  const lineas = [
    `Hola ${local}! Te hago el pedido *#${pedido.codigo}*`,
    '',
    ...pedido.items.map((i) => {
      const extras = i.extras.length > 0 ? ` + ${i.extras.map((e) => e.label).join(', ')}` : '';
      const nota = i.notas ? ` (${i.notas})` : '';
      return `• ${i.cantidad}x ${i.nombre}${extras}${nota} — ${plata(i.subtotal)}`;
    }),
    '',
    pedido.tipo === 'DELIVERY'
      ? `Envío a: ${pedido.direccion}${pedido.zona ? ` (${pedido.zona})` : ''}`
      : 'Paso a retirarlo',
  ];

  if (pedido.tipo === 'DELIVERY' && pedido.ubicacion) {
    lineas.push(`Ubicación: https://www.google.com/maps?q=${pedido.ubicacion.lat},${pedido.ubicacion.lng}`);
  }

  if (pedido.costoEnvio > 0) lineas.push(`Envío: ${plata(pedido.costoEnvio)}`);
  lineas.push(`*Total: ${plata(pedido.total)}*`);
  lineas.push(pedido.formaDePago === 'CASH' ? 'Pago en efectivo' : 'Pago por transferencia');
  if (pedido.notas) lineas.push(`Aclaración: ${pedido.notas}`);

  return lineas.join('\n');
};

export const linkDeWhatsapp = (telefono: string, mensaje: string): string =>
  `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`;
