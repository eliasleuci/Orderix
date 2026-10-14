/**
 * Formas de cobro, en un solo lugar.
 *
 * Antes cada pantalla tenía su propio mapa y ya habían divergido: el mismo
 * DIGITAL figuraba como "Digital" en el PDF, "Transf." al cobrar una mesa y
 * "QR / Transferencia" en el ticket impreso.
 */
export type MedioPago = 'CASH' | 'CARD' | 'QR' | 'TRANSFER';

export const MEDIOS_DE_PAGO: { id: MedioPago; label: string; corto: string }[] = [
  { id: 'CASH', label: 'Efectivo', corto: 'Efectivo' },
  { id: 'CARD', label: 'Tarjeta', corto: 'Tarjeta' },
  { id: 'QR', label: 'QR', corto: 'QR' },
  { id: 'TRANSFER', label: 'Transferencia', corto: 'Transf.' },
];

/**
 * DIGITAL es el valor viejo: juntaba QR y transferencia en una sola opción.
 * No se migra a ninguno de los dos porque no hay forma de saber cuál de los dos
 * fue cada cobro; se muestra tal cual para que los totales históricos cierren.
 */
const LEGADO: Record<string, string> = {
  DIGITAL: 'QR / Transf.',
  UNPAID: 'Sin cobrar',
  OTHER_LOCAL: 'A cobrar (otro local)',
};

/** Mesa que le cobró al cliente el local con el que se comparte el salón. */
export const COBRA_OTRO_LOCAL = 'OTHER_LOCAL';

export const etiquetaMedioPago = (medio?: string | null): string => {
  if (!medio) return '—';
  return MEDIOS_DE_PAGO.find((m) => m.id === medio)?.label ?? LEGADO[medio] ?? medio;
};

export const etiquetaCorta = (medio?: string | null): string => {
  if (!medio) return '—';
  return MEDIOS_DE_PAGO.find((m) => m.id === medio)?.corto ?? LEGADO[medio] ?? medio;
};

/** Lo que entra al cajón. Todo lo demás es electrónico. */
export const esEfectivo = (medio?: string | null) => medio === 'CASH';

/** Consumido pero la plata todavía no entró: mesa abierta, o la cobró el otro local. */
export const pendienteDeCobro = (medio?: string | null) => medio === 'UNPAID' || medio === COBRA_OTRO_LOCAL;

/** Cobrado, en cualquier forma. */
export const estaCobrado = (medio?: string | null) => Boolean(medio) && !pendienteDeCobro(medio);
