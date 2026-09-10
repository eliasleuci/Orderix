import dotenv from 'dotenv';
import { z } from 'zod';
import { logger } from '../common/utils/logger';

dotenv.config();

/**
 * Validación de variables de entorno al arranque.
 *
 * Sin esto, una variable faltante se descubre recién cuando alguien usa la
 * funcionalidad que la necesita: hasta hoy, la falta de SUPABASE_SERVICE_ROLE_KEY
 * se manifestaba como un 500 al intentar dar de alta el primer cliente.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'Cadena de conexión a Postgres (pooler de Supabase)'),
  JWT_SECRET: z.string().min(16, 'Debe tener al menos 16 caracteres'),
  SUPABASE_URL: z.string().url('Debe ser la URL del proyecto de Supabase'),
  SUPABASE_ANON_KEY: z.string().min(1, 'Clave pública (anon) de Supabase'),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, 'Clave service_role de Supabase. Necesaria para crear y borrar usuarios'),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const detalle = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');

  logger.error(
    `Faltan variables de entorno obligatorias:\n${detalle}\n\n` +
      'Configuralas en server/.env (local) y en las variables de entorno de Vercel ' +
      '(producción). Ninguna de estas debe llevar el prefijo VITE_: ese prefijo las ' +
      'publica en el bundle del navegador.'
  );

  throw new Error('Configuración de entorno inválida');
}

export const env: Env = parsed.data;
