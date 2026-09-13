import axios from 'axios';
import { supabase } from '../lib/supabase';

// URL del backend Express.
// En producción el backend vive en el mismo dominio (rewrite /api/* -> api/index.ts
// en vercel.json), así que el fallback nunca debe apuntar a localhost.
export const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:3000/api' : '/api');

export const baseApi = axios.create({
  baseURL: API_URL,
});

// Interceptor para inyectar el token de Supabase en las peticiones al backend
baseApi.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

/**
 * Un token vencido dejaba la pantalla colgada con un "Invalid token" y sin
 * salida: el backend responde 401 y nadie se hacía cargo. Pasa solo, sin que
 * nadie toque nada, en cualquier pantalla que quede abierta más de una hora
 * -la tablet de la cocina, la caja durante todo el servicio-.
 *
 * Acá se intenta renovar la sesión una vez y repetir el pedido. Si la sesión ya
 * no se puede renovar, se va al login, que es lo que corresponde, en vez de
 * dejar a alguien mirando una lista vacía en pleno servicio.
 */
baseApi.interceptors.response.use(
  (respuesta) => respuesta,
  async (error) => {
    const original = error.config;
    const esNoAutorizado = error.response?.status === 401;

    // El login mismo responde 401 con la contraseña equivocada: ahí no hay
    // ninguna sesión que renovar y mandarlo al login sería un bucle.
    const esDeLogin = original?.url?.includes('/auth/');

    // La carta y el checkout también salen por acá y los usa gente sin cuenta:
    // mandar a un cliente que está pidiendo una hamburguesa a la pantalla de
    // login del sistema sería bastante peor que el error original.
    const esPublico = original?.url?.includes('/publico/');

    if (!esNoAutorizado || esDeLogin || esPublico || original?._reintentado) {
      return Promise.reject(error);
    }

    original._reintentado = true;

    const { data, error: fallo } = await supabase.auth.refreshSession();
    if (!fallo && data.session?.access_token) {
      original.headers.Authorization = `Bearer ${data.session.access_token}`;
      return baseApi(original);
    }

    await supabase.auth.signOut().catch(() => {});
    if (typeof window !== 'undefined') window.location.replace('/login');
    return Promise.reject(error);
  }
);
