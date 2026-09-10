import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // './' (relativo) es lo que necesita el build de Electron, que carga
  // dist/index.html por file:// y ahí una ruta absoluta como /assets/...
  // no resuelve a nada.
  //
  // El deploy web (Vercel) pasa --base=/ para pisar esto (ver
  // package.json de la raíz, script build:prod). Con rutas relativas,
  // un F5 en cualquier ruta de 2+ segmentos (/superadmin/clientes) hace
  // que el navegador resuelva "./assets/x.js" como
  // /superadmin/assets/x.js en vez de /assets/x.js: cae en el rewrite
  // de SPA de vercel.json, que le responde el index.html en vez del
  // JS, y el módulo falla por MIME type.
  base: './',
  plugins: [
    react(),
    tailwindcss(),
  ],
});
