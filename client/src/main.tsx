import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

/**
 * Recarga sola cuando la pestaña quedó con una versión vieja de la app.
 *
 * Cada build genera los archivos con un hash distinto, y al desplegar los
 * anteriores dejan de existir en el servidor. Una pestaña abierta desde antes
 * del deploy sigue apuntando a los viejos: al entrar a una pantalla que todavía
 * no había cargado, pide un archivo que ya no está, falla y queda en blanco.
 * Pasaba seguido al volver de otra pestaña, porque es cuando se navega.
 *
 * Antes había que apretar F5 a mano. Ahora se recarga sola, que es lo mismo
 * pero sin que el local se quede mirando una pantalla rota en pleno servicio.
 */
const MARCA_RECARGA = 'orderix:recarga-por-version';

const recargarPorVersionVieja = () => {
  // Sin esta guarda, una caída de red real dejaría la pestaña recargando en
  // bucle: falla, recarga, vuelve a fallar. Si ya se recargó por esto hace
  // menos de 10 segundos, se deja la pantalla como está.
  try {
    const ultima = Number(sessionStorage.getItem(MARCA_RECARGA) ?? 0);
    if (Date.now() - ultima < 10_000) return;
    sessionStorage.setItem(MARCA_RECARGA, String(Date.now()));
  } catch {
    // Navegador con el almacenamiento bloqueado: se recarga igual una vez.
  }

  window.location.reload();
};

// El evento propio de Vite para cuando falla la carga de un módulo diferido.
window.addEventListener('vite:preloadError', (e) => {
  e.preventDefault();
  recargarPorVersionVieja();
});

// Red de seguridad: el evento de arriba no lo emiten todos los navegadores, y
// el error termina saliendo como una promesa sin atrapar.
window.addEventListener('unhandledrejection', (e) => {
  const mensaje = String(e.reason?.message ?? e.reason ?? '');
  if (/Failed to fetch dynamically imported module|error loading dynamically imported module/i.test(mensaje)) {
    recargarPorVersionVieja();
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
