import { ThermalPrinter, PrinterTypes, CharacterSet } from 'node-thermal-printer';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

// Este archivo es un módulo ESM, donde require() no existe. El modo windows
// necesita pasarle el driver a node-thermal-printer, y ese paquete es nativo:
// se carga acá, sólo si hace falta.
const require = createRequire(import.meta.url);

/**
 * Impresión de tickets térmicos.
 *
 * Se usa node-thermal-printer en lugar de escpos/escpos-usb porque esta última
 * está en alfa, no está declarada como dependencia (el servidor ni arrancaba) y
 * en Windows obliga a reemplazar el driver USB por libusb con Zadig, lo que deja
 * la impresora inservible para cualquier otro programa.
 *
 * Tres modos, según PRINTER_TYPE:
 *   red        -> TCP al puerto 9100. Es el más confiable: no necesita drivers.
 *   windows    -> por nombre de impresora, usando el driver del fabricante.
 *   simulacion -> no imprime: guarda el ticket en tickets/ y lo muestra en
 *                 consola. Sirve para validar el formato sin tener el equipo.
 */

const ANCHO = 48; // caracteres por línea en papel de 80mm
const CARPETA_TICKETS = 'tickets';

export const config = {
  modo: (process.env.PRINTER_TYPE || 'simulacion').toLowerCase(),
  host: process.env.PRINTER_HOST || '192.168.0.100',
  puerto: Number(process.env.PRINTER_PORT || 9100),
  nombre: process.env.PRINTER_NAME || '',
  copias: (process.env.PRINT_ON_ORDER || 'both').toLowerCase(),
};

const centrar = (t) => {
  const libre = Math.max(0, ANCHO - t.length);
  return ' '.repeat(Math.floor(libre / 2)) + t;
};
const repetir = (c) => c.repeat(ANCHO);
const plata = (v) => '$' + Number(v || 0).toLocaleString('es-AR');

const fechaHora = (iso) => {
  const d = iso ? new Date(iso) : new Date();
  return {
    // 24 horas: en un ticket el 'a. m./p. m.' ocupa lugar y se lee peor.
    hora: d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }),
    fecha: d.toLocaleDateString('es-AR'),
  };
};

const TIPO = {
  MESA: 'SALON',
  TAKEAWAY: 'MOSTRADOR',
  DELIVERY: 'DELIVERY',
};

const PAGO = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  DIGITAL: 'QR / Transferencia',
  UNPAID: 'Pendiente de pago',
};

/** Dos columnas: texto a la izquierda, importe pegado a la derecha. */
const enLinea = (izq, der) => {
  const libre = Math.max(1, ANCHO - izq.length - der.length);
  return izq + ' '.repeat(libre) + der;
};

const crearImpresora = () => {
  if (config.modo === 'red') {
    return new ThermalPrinter({
      type: PrinterTypes.EPSON,
      interface: `tcp://${config.host}:${config.puerto}`,
      characterSet: CharacterSet.PC858_EURO,
      removeSpecialCharacters: false,
      width: ANCHO,
      options: { timeout: 5000 },
    });
  }

  if (config.modo === 'windows') {
    if (!config.nombre) {
      throw new Error('Falta PRINTER_NAME: el nombre exacto de la impresora en Windows.');
    }
    let driver;
    try {
      driver = require('printer');
    } catch {
      throw new Error(
        'Para el modo windows falta el paquete del driver. Instalalo con: ' +
          'npm install printer   (o usá PRINTER_TYPE=red, que no necesita drivers)'
      );
    }

    return new ThermalPrinter({
      type: PrinterTypes.EPSON,
      interface: `printer:${config.nombre}`,
      characterSet: CharacterSet.PC858_EURO,
      removeSpecialCharacters: false,
      width: ANCHO,
      driver,
    });
  }

  return null; // simulación
};

/** Estado para que el POS sepa si puede imprimir antes de intentarlo. */
export async function estadoImpresora() {
  if (config.modo === 'simulacion') {
    return {
      status: 'ready',
      modo: 'simulacion',
      detalle: `Los tickets se guardan en ${CARPETA_TICKETS}/ en vez de imprimirse`,
    };
  }

  try {
    const impresora = crearImpresora();
    const conectada = await impresora.isPrinterConnected();
    return {
      status: conectada ? 'ready' : 'disconnected',
      modo: config.modo,
      detalle: conectada
        ? `Conectada (${config.modo === 'red' ? `${config.host}:${config.puerto}` : config.nombre})`
        : 'No responde. Revisá que esté encendida y en red.',
    };
  } catch (err) {
    return { status: 'disconnected', modo: config.modo, detalle: err.message };
  }
}

/**
 * Envía el ticket ya armado.
 *
 * En simulación lo escribe a disco: así se puede revisar el formato exacto,
 * carácter por carácter, sin tener la impresora.
 */
async function emitir(lineasTexto, impresora, nombreArchivo) {
  if (config.modo === 'simulacion') {
    if (!fs.existsSync(CARPETA_TICKETS)) fs.mkdirSync(CARPETA_TICKETS, { recursive: true });
    const ruta = path.join(CARPETA_TICKETS, nombreArchivo);
    fs.writeFileSync(ruta, lineasTexto, 'utf8');
    console.log('\n' + lineasTexto + '\n');
    console.log(`   [simulación] ticket guardado en ${ruta}`);
    return { archivo: ruta };
  }

  await impresora.execute();
  return {};
}

export async function imprimirTicketCocina(order) {
  const { hora, fecha } = fechaHora(order.time);
  const numero = String(order.ticketNumber ?? '---').padStart(3, '0');
  const destino = order.table || TIPO[order.orderType] || order.orderType || '-';

  const l = [];
  l.push(centrar('*** COCINA ***'));
  l.push(repetir('='));
  l.push(`ORDEN #${numero}`);
  l.push(destino);
  l.push(`${hora}  ${fecha}`);
  if (order.customerName) l.push(`Cliente: ${order.customerName}`);
  l.push(repetir('-'));
  l.push('');

  for (const item of order.items || []) {
    l.push(`${item.quantity}x ${String(item.name || '').toUpperCase()}`);

    const mods = (item.modifiers || [])
      .map((m) => (typeof m === 'string' ? m : m.label))
      .filter(Boolean);
    // Los agregados y las aclaraciones son lo que más se lee mal en cocina:
    // van indentados y en mayúscula para que se distingan del producto.
    if (mods.length) l.push('   + ' + mods.join(', ').toUpperCase());
    if (item.notes) l.push('   ** ' + String(item.notes).toUpperCase());
    l.push('');
  }

  l.push(repetir('='));
  l.push('');

  const texto = l.join('\n');

  let impresora = null;
  if (config.modo !== 'simulacion') {
    impresora = crearImpresora();
    impresora.alignCenter();
    impresora.setTextDoubleHeight();
    impresora.bold(true);
    impresora.println('*** COCINA ***');
    impresora.setTextNormal();
    impresora.bold(false);
    impresora.drawLine();

    impresora.alignLeft();
    impresora.setTextDoubleHeight();
    impresora.bold(true);
    impresora.println(`ORDEN #${numero}`);
    impresora.println(destino);
    impresora.setTextNormal();
    impresora.bold(false);
    impresora.println(`${hora}  ${fecha}`);
    if (order.customerName) impresora.println(`Cliente: ${order.customerName}`);
    impresora.drawLine();
    impresora.newLine();

    for (const item of order.items || []) {
      impresora.setTextDoubleHeight();
      impresora.bold(true);
      impresora.println(`${item.quantity}x ${String(item.name || '').toUpperCase()}`);
      impresora.setTextNormal();
      impresora.bold(false);

      const mods = (item.modifiers || [])
        .map((m) => (typeof m === 'string' ? m : m.label))
        .filter(Boolean);
      if (mods.length) impresora.println('   + ' + mods.join(', ').toUpperCase());
      if (item.notes) impresora.println('   ** ' + String(item.notes).toUpperCase());
      impresora.newLine();
    }

    impresora.drawLine();
    impresora.cut();
  }

  return emitir(texto, impresora, `cocina-${numero}-${Date.now()}.txt`);
}

export async function imprimirTicketCliente(order) {
  const { hora, fecha } = fechaHora(order.time);
  const numero = String(order.ticketNumber ?? '---').padStart(3, '0');

  const l = [];
  l.push(centrar((order.negocio || 'ORDERIX').toUpperCase()));
  if (order.sucursal) l.push(centrar(order.sucursal));
  l.push('');
  l.push(repetir('='));
  l.push(`TICKET #${numero}`);
  l.push(`${hora}  ${fecha}`);
  l.push(`Tipo: ${TIPO[order.orderType] || order.orderType || '-'}`);
  if (order.table) l.push(`Mesa: ${order.table}`);
  if (order.customerName) l.push(`Cliente: ${order.customerName}`);
  if (order.customerAddress) l.push(`Direccion: ${order.customerAddress}`);
  l.push(repetir('-'));

  for (const item of order.items || []) {
    const importe = Number(item.price || 0) * Number(item.quantity || 0);
    l.push(enLinea(`${item.quantity}x ${item.name}`, plata(importe)));

    const mods = (item.modifiers || [])
      .map((m) => (typeof m === 'string' ? { label: m, price: 0 } : m))
      .filter((m) => m && m.label);
    for (const m of mods) {
      l.push(enLinea(`   + ${m.label}`, m.price ? plata(m.price) : ''));
    }
  }

  l.push(repetir('-'));
  l.push(enLinea('TOTAL', plata(order.total)));
  l.push(`Pago: ${PAGO[order.paymentMethod] || order.paymentMethod || '-'}`);
  l.push('');
  l.push(centrar('Gracias por su compra'));
  l.push('');

  const texto = l.join('\n');

  let impresora = null;
  if (config.modo !== 'simulacion') {
    impresora = crearImpresora();
    impresora.alignCenter();
    impresora.bold(true);
    impresora.setTextDoubleHeight();
    impresora.println((order.negocio || 'ORDERIX').toUpperCase());
    impresora.setTextNormal();
    impresora.bold(false);
    if (order.sucursal) impresora.println(order.sucursal);
    impresora.drawLine();

    impresora.alignLeft();
    impresora.bold(true);
    impresora.println(`TICKET #${numero}`);
    impresora.bold(false);
    impresora.println(`${hora}  ${fecha}`);
    impresora.println(`Tipo: ${TIPO[order.orderType] || order.orderType || '-'}`);
    if (order.table) impresora.println(`Mesa: ${order.table}`);
    if (order.customerName) impresora.println(`Cliente: ${order.customerName}`);
    if (order.customerAddress) impresora.println(`Direccion: ${order.customerAddress}`);
    impresora.drawLine();

    for (const item of order.items || []) {
      const importe = Number(item.price || 0) * Number(item.quantity || 0);
      impresora.leftRight(`${item.quantity}x ${item.name}`, plata(importe));

      const mods = (item.modifiers || [])
        .map((m) => (typeof m === 'string' ? { label: m, price: 0 } : m))
        .filter((m) => m && m.label);
      for (const m of mods) {
        impresora.leftRight(`   + ${m.label}`, m.price ? plata(m.price) : '');
      }
    }

    impresora.drawLine();
    impresora.bold(true);
    impresora.setTextDoubleHeight();
    impresora.leftRight('TOTAL', plata(order.total));
    impresora.setTextNormal();
    impresora.bold(false);
    impresora.println(`Pago: ${PAGO[order.paymentMethod] || order.paymentMethod || '-'}`);
    impresora.newLine();
    impresora.alignCenter();
    impresora.println('Gracias por su compra');
    impresora.cut();
  }

  return emitir(texto, impresora, `cliente-${numero}-${Date.now()}.txt`);
}

export async function imprimirPrueba() {
  const ahora = new Date();
  const l = [
    centrar('PRUEBA DE IMPRESION'),
    repetir('='),
    `Modo: ${config.modo}`,
    `Fecha: ${ahora.toLocaleString('es-AR')}`,
    repetir('-'),
    'Si estas leyendo esto en papel,',
    'la impresora quedo configurada.',
    repetir('='),
    '',
  ];
  const texto = l.join('\n');

  let impresora = null;
  if (config.modo !== 'simulacion') {
    impresora = crearImpresora();
    impresora.alignCenter();
    impresora.bold(true);
    impresora.println('PRUEBA DE IMPRESION');
    impresora.bold(false);
    impresora.drawLine();
    impresora.alignLeft();
    impresora.println(`Modo: ${config.modo}`);
    impresora.println(`Fecha: ${ahora.toLocaleString('es-AR')}`);
    impresora.drawLine();
    impresora.println('Si estas leyendo esto en papel,');
    impresora.println('la impresora quedo configurada.');
    impresora.cut();
  }

  return emitir(texto, impresora, `prueba-${Date.now()}.txt`);
}
