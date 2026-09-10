export type BillingState = 'AL_DIA' | 'POR_VENCER' | 'VENCIDO' | 'SIN_FECHA';

/** Días de anticipación con los que se avisa que una suscripción está por vencer. */
export const DIAS_AVISO_VENCIMIENTO = 15;

/**
 * Estado de facturación de un cliente.
 *
 * Se calcula en lectura y en el servidor: no hay job ni cron que marque
 * vencidos, y así el frontend no duplica la regla.
 */
export const computeBillingState = (
  expiresAt: Date | null | undefined,
  isActive: boolean | null | undefined
): BillingState => {
  if (isActive === false) return 'VENCIDO';
  if (!expiresAt) return 'SIN_FECHA';

  const hoy = new Date();
  const dias = Math.ceil((expiresAt.getTime() - hoy.getTime()) / 86_400_000);

  if (dias < 0) return 'VENCIDO';
  if (dias <= DIAS_AVISO_VENCIMIENTO) return 'POR_VENCER';
  return 'AL_DIA';
};

/** Días que faltan para el vencimiento. Negativo si ya venció. */
export const diasRestantes = (expiresAt: Date | null | undefined): number | null => {
  if (!expiresAt) return null;
  return Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000);
};
