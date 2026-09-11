import type { DatosReporte, Periodo } from './reporte';

const MONEDA = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

const TITULO: Record<Periodo, string> = {
  dia: 'Reporte del día',
  semana: 'Reporte semanal',
  mes: 'Reporte mensual',
};

const METODO: Record<string, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  DIGITAL: 'Digital',
};

const TIPO: Record<string, string> = {
  TAKEAWAY: 'Mostrador',
  DINE_IN: 'Salón',
  DELIVERY: 'Delivery',
};

const hora = (v: string) =>
  new Date(v).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

const AMBAR: [number, number, number] = [245, 158, 11];
const PIZARRA: [number, number, number] = [15, 23, 42];
const GRIS: [number, number, number] = [100, 116, 139];

/**
 * Arma el PDF y dispara la descarga.
 *
 * jsPDF se importa en el momento para que no entre en el bundle inicial: son
 * varios cientos de KB que sólo hacen falta cuando alguien pide un reporte.
 */
export const descargarReportePdf = async (d: DatosReporte) => {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const ancho = doc.internal.pageSize.getWidth();
  const margen = 40;

  // ---------- Encabezado ----------
  doc.setFillColor(...PIZARRA);
  doc.rect(0, 0, ancho, 90, 'F');

  doc.setTextColor(...AMBAR);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('ORDERIX', margen, 32);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(17);
  doc.text(TITULO[d.periodo], margen, 55);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`${d.negocio}  ·  ${d.sucursal}`, margen, 72);

  doc.setTextColor(200, 200, 200);
  doc.setFontSize(8);
  doc.text(d.rango.etiqueta, ancho - margen, 55, { align: 'right' });
  doc.text(
    `Generado el ${d.generadoEl.toLocaleDateString('es-AR')} a las ${d.generadoEl.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`,
    ancho - margen,
    72,
    { align: 'right' }
  );

  // ---------- Resumen ----------
  let y = 120;
  doc.setTextColor(...PIZARRA);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Resumen', margen, y);
  y += 12;

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    head: [['Total vendido', 'Órdenes', 'Ticket promedio', 'Efectivo', 'Tarjeta / Digital']],
    body: [[
      MONEDA.format(d.totalVentas),
      String(d.cantidadOrdenes),
      MONEDA.format(d.ticketPromedio),
      MONEDA.format(d.efectivo),
      MONEDA.format(d.tarjeta),
    ]],
    headStyles: { fillColor: PIZARRA, fontSize: 8, halign: 'center' },
    bodyStyles: { fontSize: 11, fontStyle: 'bold', halign: 'center', textColor: PIZARRA },
    margin: { left: margen, right: margen },
  });

  y = (doc as any).lastAutoTable.finalY + 28;

  // ---------- Ventas por día (sólo aporta si el rango abarca varios) ----------
  if (d.periodo !== 'dia' && d.porDia.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Ventas por día', margen, y);
    y += 12;

    autoTable(doc, {
      startY: y,
      theme: 'striped',
      head: [['Fecha', 'Órdenes', 'Importe']],
      body: d.porDia.map((f) => [f.fecha, String(f.ordenes), MONEDA.format(f.importe)]),
      headStyles: { fillColor: AMBAR, textColor: PIZARRA, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' } },
      margin: { left: margen, right: margen },
    });
    y = (doc as any).lastAutoTable.finalY + 28;
  }

  // ---------- Productos vendidos ----------
  if (d.productos.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Productos vendidos', margen, y);
    y += 12;

    autoTable(doc, {
      startY: y,
      theme: 'striped',
      head: [['Producto', 'Cantidad', 'Importe']],
      body: d.productos.map((p) => [p.nombre, String(p.cantidad), MONEDA.format(p.importe)]),
      headStyles: { fillColor: AMBAR, textColor: PIZARRA, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' } },
      margin: { left: margen, right: margen },
    });
    y = (doc as any).lastAutoTable.finalY + 28;
  }

  // ---------- Detalle de órdenes ----------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Detalle de órdenes', margen, y);
  y += 12;

  autoTable(doc, {
    startY: y,
    theme: 'striped',
    head: [['Fecha', 'Hora', 'Cliente', 'Tipo', 'Pago', 'Total']],
    body:
      d.ordenes.length > 0
        ? d.ordenes.map((o) => [
            new Date(o.created_at).toLocaleDateString('es-AR'),
            hora(o.created_at),
            o.customer_name || 'Mostrador',
            TIPO[o.order_type] ?? o.order_type,
            METODO[o.payment_method] ?? o.payment_method,
            MONEDA.format(Number(o.total ?? 0)),
          ])
        : [['—', '—', 'Sin ventas registradas en este período', '—', '—', '—']],
    headStyles: { fillColor: AMBAR, textColor: PIZARRA, fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 5: { halign: 'right' } },
    margin: { left: margen, right: margen },
    // El pie se dibuja por página para que el total quede visible al imprimir.
    didDrawPage: () => {
      const alto = doc.internal.pageSize.getHeight();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...GRIS);
      doc.text(`${d.negocio} · ${d.sucursal} · ${d.rango.etiqueta}`, margen, alto - 20);
      doc.text(
        `Total del período: ${MONEDA.format(d.totalVentas)}`,
        ancho - margen,
        alto - 20,
        { align: 'right' }
      );
    },
  });

  const stamp = d.generadoEl.toISOString().slice(0, 10);
  doc.save(`orderix-${d.periodo}-${stamp}.pdf`);
};
