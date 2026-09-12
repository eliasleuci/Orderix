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
};

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

/** Cobrado, en cualquier forma. UNPAID es una mesa abierta, no un cobro. */
export const estaCobrado = (medio?: string | null) => Boolean(medio) && medio !== 'UNPAID';
