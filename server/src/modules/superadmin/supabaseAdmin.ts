import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../../common/exceptions/AppError';

let client: SupabaseClient | null = null;

/**
 * Cliente de Supabase con la clave secreta (service_role).
 *
 * Ignora RLS y habilita la Admin API: es lo único que puede crear, borrar y
 * cambiarle la contraseña a un usuario. Por eso vive sólo en el servidor.
 */
export const getSupabaseAdmin = (): SupabaseClient => {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new AppError(
      'SUPABASE_SERVICE_ROLE_KEY no está configurada en el servidor. ' +
        'Sin ella no se pueden crear ni borrar usuarios.',
      500
    );
  }

  client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return client;
};

/** Traduce los errores de Supabase Auth a algo que se pueda mostrar en pantalla. */
export const mapAuthError = (message: string): AppError => {
  const m = message.toLowerCase();

  if (m.includes('already registered') || m.includes('already been registered')) {
    return new AppError('Ese email ya tiene una cuenta en Orderix', 409);
  }
  if (m.includes('password')) {
    return new AppError(`Contraseña inválida: ${message}`, 400);
  }
  if (m.includes('email')) {
    return new AppError(`Email inválido: ${message}`, 400);
  }
  return new AppError(`Error de Supabase Auth: ${message}`, 400);
};
