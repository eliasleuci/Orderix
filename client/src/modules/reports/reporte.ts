import { supabase } from '../../lib/supabase';
import { orderService } from '../../services/orderService';
import type { Order } from '../../types/domain';

export type Periodo = 'dia' | 'semana' | 'mes';

export const PERIODOS: Array<{ id: Periodo; label: string; detalle: string }> = [
  { id: 'dia', label: 'Del día', detalle: 'Lo vendido hoy, desde las 00:00' },
  { id: 'semana', label: 'Semanal', detalle: 'Los últimos 7 días' },
  { id: 'mes', label: 'Mensual', detalle: 'Desde el 1° del mes en curso' },
];

export interface Rango {
  desde: Date;
  hasta: Date;
  etiqueta: string;
}

/** Mismos criterios que usan los filtros de la pantalla Financiero. */
export const rangoDe = (periodo: Periodo): Rango => {
  const hasta = new Date();
  const desde = new Date();
  desde.setHours(0, 0, 0, 0);

  if (periodo === 'semana') {
    desde.setDate(desde.getDate() - 7);
  } else if (periodo === 'mes') {
    desde.setDate(1);
  }

  const f = (d: Date) => d.toLocaleDateString('es-AR');
  const etiqueta =
    periodo === 'dia' ? f(desde) : `${f(desde)} al ${f(hasta)}`;

  return { desde, hasta, etiqueta };
};

export interface ProductoVendido {
  nombre: string;
  cantidad: number;
  importe: number;
}

export interface DatosReporte {
  negocio: string;
  sucursal: string;
  periodo: Periodo;
  rango: Rango;
  generadoEl: Date;
  totalVentas: number;
  cantidadOrdenes: number;
  ticketPromedio: number;
  efectivo: number;
  tarjeta: number;
  porDia: Array<{ fecha: string; ordenes: number; importe: number }>;
  productos: ProductoVendido[];
  ordenes: Order[];
}

const esTarjeta = (m?: string) => m === 'CARD' || m === 'DIGITAL';

/** Nombre del negocio y de la sucursal para el encabezado del reporte. */
const obtenerEncabezado = async (branchId: string) => {
  const { data } = await supabase
    .from('branches')
    .select('name, tenants(name)')
    .eq('id', branchId)
    .single();

  const tenant: any = (data as any)?.tenants;
  return {
    sucursal: (data as any)?.name ?? 'Sucursal',
    negocio: (Array.isArray(tenant) ? tenant[0]?.name : tenant?.name) ?? 'Orderix',
  };
};

export const obtenerDatos = async (
  branchId: string,
  periodo: Periodo
): Promise<DatosReporte> => {
  const rango = rangoDe(periodo);

  // Sin límite chico: un mes de ventas puede superar holgadamente las 500
  // órdenes y el reporte quedaría recortado sin avisar.
  const { data, error } = await orderService.getBranchOrders(
    branchId,
    5000,
    rango.desde.toISOString()
  );
  if (error) throw new Error(error);

  const ordenes = (data ?? []).filter((o) => {
    const d = new Date(o.created_at);
    return d >= rango.desde && d <= rango.hasta;
  });

  const totalVentas = ordenes.reduce((a, o) => a + Number(o.total ?? 0), 0);
  const efectivo = ordenes
    .filter((o) => o.payment_method === 'CASH')
    .reduce((a, o) => a + Number(o.total ?? 0), 0);
  const tarjeta = ordenes
    .filter((o) => esTarjeta(o.payment_method))
    .reduce((a, o) => a + Number(o.total ?? 0), 0);

  // Ventas por día: sirve para ver la evolución en los reportes de semana y mes.
  const mapaDias = new Map<string, { ordenes: number; importe: number }>();
  for (const o of ordenes) {
    const clave = new Date(o.created_at).toLocaleDateString('es-AR');
    const actual = mapaDias.get(clave) ?? { ordenes: 0, importe: 0 };
    actual.ordenes += 1;
    actual.importe += Number(o.total ?? 0);
    mapaDias.set(clave, actual);
  }

  // Productos vendidos: la base para controlar stock contra lo facturado.
  const mapaProd = new Map<string, ProductoVendido>();
  for (const o of ordenes) {
    for (const it of o.order_items ?? []) {
      const nombre = it.products?.name ?? 'Producto eliminado';
      const precio = Number(it.price_at_sale ?? it.unit_price ?? 0);
      const actual = mapaProd.get(nombre) ?? { nombre, cantidad: 0, importe: 0 };
      actual.cantidad += Number(it.quantity ?? 0);
      actual.importe += precio * Number(it.quantity ?? 0);
      mapaProd.set(nombre, actual);
    }
  }

  const { negocio, sucursal } = await obtenerEncabezado(branchId);

  return {
    negocio,
    sucursal,
    periodo,
    rango,
    generadoEl: new Date(),
    totalVentas,
    cantidadOrdenes: ordenes.length,
    ticketPromedio: ordenes.length > 0 ? totalVentas / ordenes.length : 0,
    efectivo,
    tarjeta,
    porDia: [...mapaDias.entries()]
      .map(([fecha, v]) => ({ fecha, ...v }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha)),
    productos: [...mapaProd.values()].sort((a, b) => b.cantidad - a.cantidad),
    ordenes: [...ordenes].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    ),
  };
};
