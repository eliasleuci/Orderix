/**
 * Instala el servidor de impresión como servicio de Windows.
 *
 * Con esto arranca solo al prender la computadora, antes incluso de que alguien
 * inicie sesión, y Windows lo vuelve a levantar si se cae. Es lo que conviene en
 * una caja: nadie tiene que acordarse de abrir una ventana negra cada mañana.
 *
 * Hay que ejecutarlo como ADMINISTRADOR:
 *   npm run servicio:instalar
 *
 * Para sacarlo:
 *   npm run servicio:desinstalar
 */
import { Service } from 'node-windows';
import path from 'path';
import { fileURLToPath } from 'url';

const aqui = path.dirname(fileURLToPath(import.meta.url));

const servicio = new Service({
  name: 'Orderix Print Server',
  description: 'Imprime las comandas de cocina y los tickets de Orderix en la impresora térmica.',
  script: path.join(aqui, 'server.js'),
  nodeOptions: [],
  // Si el proceso se cae, Windows espera unos segundos y lo reintenta. El tope
  // evita que quede reintentando para siempre si el problema es de fondo.
  wait: 2,
  grow: 0.5,
  maxRestarts: 10,
});

servicio.on('install', () => {
  console.log('');
  console.log('  Servicio instalado. Arrancando...');
  servicio.start();
});

servicio.on('start', () => {
  console.log('');
  console.log('  LISTO. El servidor de impresión ya está corriendo.');
  console.log('  Va a arrancar solo cada vez que se prenda la computadora.');
  console.log('');
  console.log('  Para comprobarlo, abrí en el navegador:');
  console.log('     http://localhost:3001/status');
  console.log('');
  console.log('  Se administra desde Windows: tecla Windows + R, escribir');
  console.log('  services.msc, y buscar "Orderix Print Server".');
  console.log('');
});

servicio.on('alreadyinstalled', () => {
  console.log('');
  console.log('  El servicio ya estaba instalado.');
  console.log('  Si querés reinstalarlo, primero: npm run servicio:desinstalar');
  console.log('');
});

servicio.on('error', (e) => {
  console.error('');
  console.error('  No se pudo instalar el servicio.');
  console.error('  Casi siempre es porque falta ejecutarlo como administrador:');
  console.error('  cerrá esta ventana, buscá "PowerShell", clic derecho y');
  console.error('  elegí "Ejecutar como administrador".');
  console.error('');
  console.error('  Detalle:', e);
});

console.log('');
console.log('  Instalando el servidor de impresión como servicio de Windows...');
console.log('  (si aparece un cartel de permisos, hay que aceptarlo)');
servicio.install();
