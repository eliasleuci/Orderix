import express from 'express';
import cors from 'cors';
import { printKitchenTicket, printCustomerTicket, findPrinter, listPrinters } from './printer.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

let printerDevice = null;

async function initPrinter() {
  try {
    printerDevice = await findPrinter();
    console.log('✅ Impresora térmica conectada');
    console.log('   Listo para imprimir tickets');
  } catch (err) {
    console.log('⚠️  No se detectó impresora térmica');
    console.log('   Conectá la impresora USB y reiniciá el servidor');
    printerDevice = null;
  }
}

app.get('/status', (req, res) => {
  res.json({
    status: printerDevice ? 'ready' : 'disconnected',
    message: printerDevice 
      ? 'Impresora lista' 
      : 'Impresora no conectada'
  });
});

app.get('/printers', async (req, res) => {
  try {
    const printers = await listPrinters();
    res.json({ printers, selected: printerDevice ? 'connected' : null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/print/kitchen', async (req, res) => {
  if (!printerDevice) {
    return res.status(503).json({ 
      error: 'Impresora no conectada',
      tip: 'Conectá la impresora USB y reiniciá el servidor'
    });
  }

  try {
    const order = req.body;
    await printKitchenTicket(printerDevice, order);
    res.json({ success: true, message: 'Ticket de cocina impreso' });
  } catch (err) {
    console.error('Error printing kitchen ticket:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/print/customer', async (req, res) => {
  if (!printerDevice) {
    return res.status(503).json({ 
      error: 'Impresora no conectada',
      tip: 'Conectá la impresora USB y reiniciá el servidor'
    });
  }

  try {
    const order = req.body;
    await printCustomerTicket(printerDevice, order);
    res.json({ success: true, message: 'Ticket de cliente impreso' });
  } catch (err) {
    console.error('Error printing customer ticket:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/print/both', async (req, res) => {
  if (!printerDevice) {
    return res.status(503).json({ 
      error: 'Impresora no conectada',
      tip: 'Conectá la impresora USB y reiniciá el servidor'
    });
  }

  try {
    const order = req.body;
    await printKitchenTicket(printerDevice, order);
    await new Promise(r => setTimeout(r, 1000));
    await printCustomerTicket(printerDevice, order);
    res.json({ success: true, message: 'Ambos tickets impresos' });
  } catch (err) {
    console.error('Error printing tickets:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/print/test', async (req, res) => {
  if (!printerDevice) {
    return res.status(503).json({ 
      error: 'Impresora no conectada',
      tip: 'Conectá la impresora USB y reiniciá el servidor'
    });
  }

  try {
    const { printKitchenTicket: pK, printCustomerTicket: pC } = await import('./printer.js');
    await pK(printerDevice, {
      ticketNumber: 'TEST',
      table: 'TEST',
      customerName: 'Test de Impresión',
      items: [{ name: 'PRODUCTO TEST', quantity: 1, price: 100 }],
      time: new Date().toISOString()
    });
    res.json({ success: true, message: 'Test impreso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

initPrinter();

app.listen(PORT, () => {
  console.log('=================================');
  console.log('   PRIME BURGERS - Print Server');
  console.log('=================================');
  console.log(`   Puerto: http://localhost:${PORT}`);
  console.log('');
  console.log('   Endpoints:');
  console.log('   GET  /status        - Estado de impresora');
  console.log('   GET  /printers      - Lista impresoras');
  console.log('   POST /print/kitchen - Ticket cocina');
  console.log('   POST /print/customer- Ticket cliente');
  console.log('   POST /print/both    - Ambos tickets');
  console.log('   POST /print/test    - Test impresión');
  console.log('');
});
