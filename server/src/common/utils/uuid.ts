import { z } from 'zod';

/**
 * Un id de la base, validado por forma y no por RFC.
 *
 * `z.string().uuid()` exige los bits de versión y variante del RFC 4122 y
 * rechaza ids escritos a mano, aunque Postgres los acepte sin chistar como
 * ::uuid. El seed de `supabase/setup.sql` está lleno de esos ids
 * ('b1111111-1111-1111-1111-111111111111' es la sucursal de Prime Burgers),
 * así que son ids reales, en producción, que zod daba por inválidos: el
 * checkout de la carta moría con "Invalid UUID" al confirmar el pedido.
 *
 * Se valida el formato 8-4-4-4-12 hexadecimal, que es exactamente lo que la
 * base considera un uuid. Cualquier id que salga de gen_random_uuid() pasa
 * igual, así que no se afloja nada que importe.
 */
export const uuid = (mensaje = 'Identificador inválido') =>
  z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, mensaje);
