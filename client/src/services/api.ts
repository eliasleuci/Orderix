import axios from 'axios';
import { supabase } from '../lib/supabase';

// URL del backend Express.
// En producción el backend vive en el mismo dominio (rewrite /api/* -> api/index.ts
// en vercel.json), así que el fallback nunca debe apuntar a localhost.
const API_URL =
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
