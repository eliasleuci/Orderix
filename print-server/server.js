import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import {
  config,
  estadoImpresora,
  imprimirTicketCocina,
  imprimirTicketCliente,
  imprimirPrueba,
} from './printer.js';

const app = express();
const PORT = Number(process.env.PORT || 3001);

// El navegador entra por https://www.orderix.store y llama a este servidor en
// localhost. Los navegadores tratan localhost como origen seguro, así que la
// llamada no queda bloqueada por contenido mixto.
app.use(cors());
app.use(express.json());

app.get('/status', async (req, res) => {
  const estado = await estadoImpresora();
  res.json(estado);
});

/**
 * Cada endpoint responde 200 aunque la impresión falle.
 *
 * A propósito: la venta ya está registrada en la base cuando se llama acá. Si
 * devolviéramos error, el POS podría hacer pensar al cajero que el pedido no se
 * tomó. El detalle del fallo viaja en el cuerpo para poder avisarlo sin alarmar.
 */
const manejar = (fn, etiqueta) => async (req, res) => {
  try {
    const r = await fn(req.body || {});
    console.log(`OK  ${etiqueta}${r.archivo ? ' -> ' + r.archivo : ''}`);
    res.json({ success: true, message: `${etiqueta} impreso`, ...r });
  } catch (err) {
    console.error(`FALLO ${etiqueta}:`, err.message);
    res.json({ success: false, error: err.message, etiqueta });
  }
};

app.post('/print/kitchen', manejar(imprimirTicketCocina, 'ticket de cocina'));
app.post('/print/customer', manejar(imprimirTicketCliente, 'ticket de cliente'));
app.post('/print/test', manejar(imprimirPrueba, 'ticket de prueba'));

app.post('/print/both', async (req, res) => {
  const order = req.body || {};
  const fallos = [];
  let cocina = {};
  let cliente = {};

  try {
    cocina = await imprimirTicketCocina(order);
  } catch (err) {
    fallos.push(`cocina: ${err.message}`);
  }

  try {
    // Pequeña pausa: algunas térmicas pierden el segundo ticket si se les manda
    // todo junto sin dejarles terminar el corte.
    await new Promise((r) => setTimeout(r, 600));
    cliente = await imprimirTicketCliente(order);
  } catch (err) {
    fallos.push(`cliente: ${err.message}`);
  }

  if (fallos.length) console.error('FALLO al imprimir:', fallos.join(' | '));
  else console.log('OK  ambos tickets');

  res.json({
    success: fallos.length === 0,
    message: fallos.length ? 'Impresión incompleta' : 'Ambos tickets impresos',
    error: fallos.length ? fallos.join(' | ') : undefined,
    archivos: [cocina.archivo, cliente.archivo].filter(Boolean),
  });
});

/**
 * Impresión automática al confirmar un pedido.
 *
 * Qué se imprime lo decide el servidor según PRINT_ON_ORDER, no el navegador:
 * así se cambia en el local editando el .env, sin tocar la aplicación ni
 * volver a publicarla.
 */
app.post('/print/auto', async (req, res) => {
  const order = req.body || {};
  const quiere = config.copias;

  if (quiere === 'none') {
    return res.json({ success: true, message: 'Impresión automática desactivada', omitido: true });
  }

  const fallos = [];
  const archivos = [];

  if (quiere === 'both' || quiere === 'kitchen') {
    try {
      const r = await imprimirTicketCocina(order);
      if (r.archivo) archivos.push(r.archivo);
    } catch (err) {
      fallos.push(`cocina: ${err.message}`);
    }
  }

  if (quiere === 'both' || quiere === 'customer') {
    try {
      if (quiere === 'both') await new Promise((r) => setTimeout(r, 600));
      const r = await imprimirTicketCliente(order);
      if (r.archivo) archivos.push(r.archivo);
    } catch (err) {
      fallos.push(`cliente: ${err.message}`);
    }
  }

  if (fallos.length) console.error(`FALLO impresión automática: ${fallos.join(' | ')}`);
  else console.log(`OK  impresión automática (${quiere}) pedido #${order.ticketNumber ?? '?'}`);

  res.json({
    success: fallos.length === 0,
    message: fallos.length ? 'No se pudo imprimir' : 'Impreso',
    error: fallos.length ? fallos.join(' | ') : undefined,
    archivos,
  });
});

app.listen(PORT, () => {
  console.log('');
  console.log('  ORDERIX - Servidor de impresión');
  console.log(`  Escuchando en http://localhost:${PORT}`);
  console.log(`  Modo: ${config.modo}`);
  if (config.modo === 'red') console.log(`  Impresora: ${config.host}:${config.puerto}`);
  if (config.modo === 'windows') console.log(`  Impresora: ${config.nombre || '(falta PRINTER_NAME)'}`);
  if (config.modo === 'simulacion') {
    console.log('  No imprime: guarda los tickets en tickets/ para revisar el formato.');
    console.log('  Cuando tengas la impresora, configurá PRINTER_TYPE en .env');
  }
  console.log(`  Al confirmar un pedido se imprime: ${config.copias}`);
  console.log('');
});
