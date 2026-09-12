import { z } from 'zod';

// Tope alto pero finito: sirve para atajar un error de tipeo (un cero de más)
// antes de que quede escrito en el arqueo.
const monto = z
  .number({ message: 'Ingresá un monto válido' })
  .min(0, 'El monto no puede ser negativo')
  .max(99_999_999, 'El monto es demasiado alto');

const notas = z.string().trim().max(500, 'La nota es demasiado larga').optional().nullable();

export const abrirCajaSchema = z.object({
  body: z.object({ montoInicial: monto, notas }),
});

export const cerrarCajaSchema = z.object({
  body: z.object({ montoContado: monto, notas }),
});
