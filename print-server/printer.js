import Escpos from 'escpos';
import { USB } from 'escpos-usb';

const PRINTER_WIDTH = 48;

export async function findPrinter() {
  const devices = await USB.list();
  
  if (devices.length === 0) {
    throw new Error('No se encontraron impresoras USB');
  }

  const device = new USB(
    devices[0].deviceId
  );
  
  const printer = new Escpos.Printer(device);
  
  return { device, printer };
}

export async function listPrinters() {
  const devices = await USB.list();
  return devices.map(d => ({
    id: d.deviceId,
    name: d.deviceName || 'Impresora USB'
  }));
}

function center(text, width = PRINTER_WIDTH) {
  const padding = Math.max(0, Math.floor((width - text.length) / 2));
  return ' '.repeat(padding) + text;
}

function repeat(char, count) {
  return char.repeat(count);
}

function formatCurrency(value) {
  return '$' + Number(value).toLocaleString('es-AR');
}

function formatDateTime(isoString) {
  const date = new Date(isoString);
  const time = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  const day = date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return { time, date: day };
}

async function printText(device, text) {
  return new Promise((resolve, reject) => {
    device.write(Buffer.from(text, 'utf8'), (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function cutPaper(device) {
  return new Promise((resolve, reject) => {
    device.write(Buffer.from([0x1D, 0x56, 0x00]), (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function openCashDrawer(device) {
  return new Promise((resolve, reject) => {
    device.write(Buffer.from([0x1B, 0x70, 0x00, 0x19, 0xFA]), (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export async function printKitchenTicket(connection, order) {
  const { device, printer } = connection;
  
  const line = repeat('=', PRINTER_WIDTH);
  const divider = repeat('-', PRINTER_WIDTH);
  
  const { time, date } = formatDateTime(order.time || new Date().toISOString());
  const ticketNum = String(order.ticketNumber || '???').padStart(3, '0');
  const tableOrType = order.table || order.orderType || '-';
  
  const lines = [];

  printer.align('CT');
  printer.size(1, 1);
  printer.text('** COCINA **');
  printer.text(line);
  
  printer.align('LT');
  printer.size(1, 1);
  printer.text(`ORDEN: #${ticketNum}    ${tableOrType}`);
  printer.text(`${time} - ${date}`);
  printer.text(divider);
  printer.text('');
  
  printer.size(1, 1);
  printer.bold(true);
  
  for (const item of order.items || []) {
    const qtyName = `${item.quantity}x ${(item.name || '').toUpperCase()}`;
    const priceStr = `x${item.quantity}`;
    const spaces = PRINTER_WIDTH - qtyName.length - priceStr.length;
    
    lines.push(qtyName + ' '.repeat(Math.max(1, spaces)) + priceStr);
    
    if (item.modifiers && item.modifiers.length > 0) {
      const mods = item.modifiers.map(m => 
        typeof m === 'string' ? m : m.label
      ).join(', ');
      lines.push('  ' + mods.toUpperCase());
    }
    
    if (item.notes) {
      lines.push('  !! ' + item.notes.toUpperCase());
    }
  }
  
  printer.text(lines.join('\n'));
  
  printer.bold(false);
  printer.text('');
  printer.align('CT');
  printer.text(line);
  
  await printer.cut();
  
  return true;
}

export async function printCustomerTicket(connection, order) {
  const { printer } = connection;
  
  const line = repeat('=', PRINTER_WIDTH);
  const divider = repeat('-', PRINTER_WIDTH);
  
  const { time, date } = formatDateTime(order.time || new Date().toISOString());
  const ticketNum = String(order.ticketNumber || '???').padStart(3, '0');
  const orderType = order.orderType || 'TAKEAWAY';
  
  printer.align('CT');
  printer.size(1, 1);
  printer.text('PRIME BURGERS');
  printer.text('Gracias por elegirnos!');
  printer.text(line);
  
  printer.align('LT');
  printer.size(1, 1);
  printer.text(`ORDEN: #${ticketNum}    ${orderType}`);
  printer.text(`${time} - ${date}`);
  printer.text(divider);
  
  if (order.customerName) {
    printer.text(`Cliente: ${order.customerName}`);
    printer.text(divider);
  }
  
  if (order.customerAddress) {
    printer.text(`Dirección: ${order.customerAddress}`);
    printer.text(divider);
  }
  
  printer.text('');
  
  let subtotal = 0;
  
  for (const item of order.items || []) {
    const name = (item.name || '').toUpperCase();
    const price = item.price || 0;
    subtotal += price;
    
    const qtyStr = `${item.quantity}x`;
    const priceStr = formatCurrency(price);
    const spaces = PRINTER_WIDTH - qtyStr.length - name.length - priceStr.length;
    
    printer.text(`${qtyStr} ${name}${' '.repeat(Math.max(1, spaces))}${priceStr}`);
    
    if (item.modifiers && item.modifiers.length > 0) {
      const mods = item.modifiers.map(m => 
        typeof m === 'string' ? m : m.label
      );
      for (const mod of mods) {
        printer.text(`   + ${mod}: ${formatCurrency(mod.price || 0)}`);
      }
    }
  }
  
  printer.text(divider);
  
  const total = order.total || subtotal;
  const paymentMethod = formatPaymentMethod(order.paymentMethod);
  
  const totalSpaces = PRINTER_WIDTH - 8 - formatCurrency(total).length;
  printer.text(' '.repeat(totalSpaces) + 'TOTAL:' + formatCurrency(total));
  
  printer.text(' '.repeat(PRINTER_WIDTH - 6 - paymentMethod.length) + `PAGO: ${paymentMethod}`);
  
  printer.text('');
  printer.align('CT');
  printer.text(line);
  printer.text('Guarde su ticket');
  printer.text(line);
  
  await printer.cut();
  
  return true;
}

function formatPaymentMethod(method) {
  const methods = {
    'CASH': 'EFECTIVO',
    'CARD': 'TARJETA',
    'DIGITAL': 'PAGO DIGITAL',
    'MERCADOPAGO': 'MERCADO PAGO',
    'TRANSFER': 'TRANSFERENCIA'
  };
  return methods[method] || method || 'EFECTIVO';
}
