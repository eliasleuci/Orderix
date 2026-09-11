/**
 * Quita el servicio de Windows del servidor de impresión.
 *
 * Hay que ejecutarlo como ADMINISTRADOR:
 *   npm run servicio:desinstalar
 *
 * No borra nada de la carpeta: sólo deja de arrancar solo. Se puede seguir
 * levantando a mano con `npm start`.
 */
import { Service } from 'node-windows';
import path from 'path';
import { fileURLToPath } from 'url';

const aqui = path.dirname(fileURLToPath(import.meta.url));

const servicio = new Service({
  name: 'Orderix Print Server',
  script: path.join(aqui, 'server.js'),
});

servicio.on('uninstall', () => {
  console.log('');
  console.log('  Servicio desinstalado.');
  console.log('  Ya no arranca solo. Para usarlo ahora hay que abrir una');
  console.log('  ventana en esta carpeta y ejecutar: npm start');
  console.log('');
});

servicio.on('error', (e) => {
  console.error('');
  console.error('  No se pudo desinstalar. Suele faltar ejecutarlo como');
  console.error('  administrador. Detalle:', e);
});

console.log('');
console.log('  Quitando el servicio...');
servicio.uninstall();
