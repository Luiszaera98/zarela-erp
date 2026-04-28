import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { getECFTypeName, formatRNC, generateVerificationUrl } from '../ecf/ecfPrintUtils';

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 18;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const COLORS = {
  text: [24, 30, 43] as [number, number, number],
  muted: [143, 152, 170] as [number, number, number],
  subtle: [216, 220, 228] as [number, number, number],
  black: [15, 15, 15] as [number, number, number],
  red: [191, 34, 34] as [number, number, number],
};

const money = (value: number) =>
  `${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const safeDate = (value?: string | Date) => {
  if (!value) return 'N/A';
  try {
    return format(new Date(value), 'dd/MM/yyyy');
  } catch {
    return 'N/A';
  }
};

function drawSectionTitle(doc: jsPDF, title: string, x: number, y: number, lineEndX: number) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.text(title.toUpperCase(), x, y);
  doc.setDrawColor(...COLORS.subtle);
  doc.setLineWidth(0.3);
  doc.line(x, y + 1.2, lineEndX, y + 1.2);
}

function drawLabelValue(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  valueX: number,
  width: number,
  options?: { valueColor?: [number, number, number]; valueFont?: 'normal' | 'bold'; fontSize?: number }
) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(options?.fontSize || 8.5);
  doc.setTextColor(...COLORS.text);
  doc.text(label, x, y);

  doc.setFont('helvetica', options?.valueFont || 'normal');
  doc.setTextColor(...(options?.valueColor || COLORS.black));
  const lines = doc.splitTextToSize(value || 'N/A', width);
  doc.text(lines, valueX, y);
  return y + Math.max(lines.length, 1) * 5.5;
}

export async function generateInvoicePDF(invoice: any, companyInfo: any, isECFDoc: boolean, configuredExpirationDate?: string) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const typeCode = invoice.ncfType || (invoice.ncf?.startsWith('E') ? invoice.ncf.substring(0, 3) : 'B01');
  const documentTypeName = getECFTypeName(typeCode).toUpperCase();
  const documentCode = invoice.encf || invoice.ncf || 'S/N';
  const rightBlockWidth = 92;
  const expiryDisplay = (configuredExpirationDate || (isECFDoc ? '31-12-2028' : '31-12-2026')).replace(/-/g, '/');

  let currentY = 16;

  // Logo and top header
  try {
    doc.addImage('/zarela-logo.png', 'PNG', MARGIN - 2, currentY, 30, 30);
  } catch {
    // Browser preview may not always resolve the image. Keep the layout stable.
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.black);
  const titleLines = doc.splitTextToSize(documentTypeName, rightBlockWidth);
  doc.text(titleLines, PAGE_WIDTH - MARGIN, currentY + 8, { align: 'right' });

  doc.setFontSize(9.5);
  const titleBottomY = currentY + 8 + Math.max(titleLines.length - 1, 0) * 6;
  const ncfY = titleBottomY + 8;
  const expirationY = ncfY + 6;

  doc.setFont('helvetica', 'normal');
  doc.text(`NCF: ${documentCode}`, PAGE_WIDTH - MARGIN, ncfY, { align: 'right' });

  doc.text(`Vencimiento NCF: ${expiryDisplay}`, PAGE_WIDTH - MARGIN, expirationY, { align: 'right' });

  // Company text under logo
  const companyY = 56;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.text);
  doc.text(companyInfo.name || 'Zarela ERP', MARGIN, companyY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`RNC: ${companyInfo.rnc}`, MARGIN, companyY + 8);
  doc.text(doc.splitTextToSize(companyInfo.address || '', 112), MARGIN, companyY + 16);

  const contactLine = [companyInfo.email, companyInfo.instagram].filter(Boolean).join(' | ');
  if (contactLine) {
    doc.text(contactLine, MARGIN, companyY + 24);
  }

  // Divider
  currentY = 84;
  doc.setDrawColor(...COLORS.black);
  doc.setLineWidth(0.7);
  doc.line(MARGIN, currentY, PAGE_WIDTH - MARGIN, currentY);

  // Client and details blocks
  const leftX = MARGIN;
  const leftValueX = MARGIN + 38;
  const rightX = 110;
  const rightValueX = 130;
  const rightEnd = PAGE_WIDTH - MARGIN;

  currentY = 96;
  drawSectionTitle(doc, 'Cliente', leftX, currentY, 98);
  drawSectionTitle(doc, 'Detalles', rightX, currentY, rightEnd);

  let clientY = currentY + 10;
  clientY = drawLabelValue(doc, 'Razón Social:', invoice.clientName || 'N/A', leftX, clientY, leftValueX, 58, {
    valueFont: 'bold',
    fontSize: 8.5,
  });
  clientY = drawLabelValue(doc, 'RNC/Cédula:', formatRNC(invoice.clientRnc) || 'N/A', leftX, clientY + 1.5, leftValueX, 58, {
    valueFont: 'normal',
  });
  drawLabelValue(doc, 'Dirección:', invoice.clientAddress || 'N/A', leftX, clientY + 1.5, leftValueX, 58, {
    valueFont: 'normal',
  });

  let detailY = currentY + 10;
  detailY = drawLabelValue(doc, 'Condición:', invoice.paymentTerms || 'Contado', rightX, detailY, rightValueX, 52, {
    valueFont: 'normal',
  });
  detailY = drawLabelValue(doc, 'Vendedor:', invoice.soldBy || 'Oficina', rightX, detailY + 1.5, rightValueX, 52, {
    valueFont: 'normal',
  });

  if (invoice.sellerEmail) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text(invoice.sellerEmail, rightValueX, detailY - 0.5);
    detailY += 4.5;
  }

  detailY = drawLabelValue(doc, 'Fecha:', safeDate(invoice.date), rightX, detailY + 1.5, rightValueX, 52, {
    valueFont: 'normal',
  });
  doc.setTextColor(...COLORS.red);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Vence:', rightX, detailY + 1.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.black);
  doc.text(safeDate(invoice.dueDate), rightValueX, detailY + 1.5);

  // Table
  currentY = 147;
  const { default: autoTable } = await import('jspdf-autotable');
  const rows = (invoice.items || []).map((item: any, index: number) => [
    `${index + 1}`,
    item.productName || 'Producto',
    `${Number(item.quantity || 0).toLocaleString('en-US')}`,
    money(item.price || 0),
    money(item.total || item.subtotal || 0),
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: MARGIN, right: MARGIN },
    head: [['#', 'DESCRIPCIÓN', 'CANT', 'PRECIO', 'TOTAL']],
    body: rows,
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 8.8,
      textColor: COLORS.text,
      cellPadding: { top: 5, right: 2, bottom: 5, left: 2 },
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fontStyle: 'bold',
      fontSize: 9,
      textColor: COLORS.black,
      cellPadding: { top: 3, right: 2, bottom: 4, left: 2 },
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'left' },
      1: { cellWidth: 94, halign: 'left', fontStyle: 'bold' },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 28, halign: 'right' },
      4: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
    },
    didDrawCell: (data) => {
      if (data.section === 'head') {
        doc.setDrawColor(...COLORS.black);
        doc.setLineWidth(0.7);
        doc.line(data.cell.x, data.cell.y + data.cell.height + 0.5, data.cell.x + data.cell.width, data.cell.y + data.cell.height + 0.5);
      }

      if (data.section === 'body') {
        doc.setDrawColor(...COLORS.subtle);
        doc.setLineWidth(0.2);
        doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
      }
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  const debitNotes = invoice.debitNoteDetails || [];
  const creditNotes = invoice.creditNoteDetails || [];
  const hasAdjustments = debitNotes.length > 0 || creditNotes.length > 0;

  if (hasAdjustments) {
    const adjustmentRows = [
      ...debitNotes.map((note: any) => [
        'Nota de Debito',
        note.ncf || note.number || 'S/N',
        safeDate(note.date),
        note.reason || '',
        `+$${money(note.total || 0)}`,
      ]),
      ...creditNotes.map((note: any) => [
        'Nota de Credito',
        note.ncf || note.number || 'S/N',
        safeDate(note.date),
        note.reason || '',
        `-$${money(note.total || 0)}`,
      ]),
    ];

    autoTable(doc, {
      startY: currentY,
      margin: { left: MARGIN, right: MARGIN },
      head: [['AJUSTE', 'NCF', 'FECHA', 'MOTIVO', 'MONTO']],
      body: adjustmentRows,
      theme: 'plain',
      styles: {
        font: 'helvetica',
        fontSize: 7.8,
        textColor: COLORS.text,
        cellPadding: { top: 2.5, right: 2, bottom: 2.5, left: 2 },
        overflow: 'linebreak',
      },
      headStyles: {
        fontStyle: 'bold',
        fontSize: 8,
        textColor: COLORS.black,
        cellPadding: { top: 2, right: 2, bottom: 3, left: 2 },
      },
      columnStyles: {
        0: { cellWidth: 30, fontStyle: 'bold' },
        1: { cellWidth: 38 },
        2: { cellWidth: 24 },
        3: { cellWidth: 56 },
        4: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
      },
      didDrawCell: (data) => {
        if (data.section === 'head') {
          doc.setDrawColor(...COLORS.black);
          doc.setLineWidth(0.45);
          doc.line(data.cell.x, data.cell.y + data.cell.height + 0.4, data.cell.x + data.cell.width, data.cell.y + data.cell.height + 0.4);
        }

        if (data.section === 'body') {
          doc.setDrawColor(...COLORS.subtle);
          doc.setLineWidth(0.2);
          doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
        }
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 6;
  }

  // End of document marker
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.muted);
  doc.text('*** FIN DEL DOCUMENTO ***', PAGE_WIDTH / 2, currentY, { align: 'center' });

  currentY += 4;
  doc.setDrawColor(...COLORS.black);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, currentY, PAGE_WIDTH - MARGIN, currentY);
  currentY += 10;

  // Totals block
  const totalsX = 118;
  const totalsWidth = PAGE_WIDTH - MARGIN - totalsX;
  const subtotalValue = invoice.subtotal || (invoice.total - (invoice.tax || 0));
  const paidOrCredited = invoice.paidAmount || 0;
  const balanceDue = Math.max(0, (invoice.total || 0) - paidOrCredited);

  const totalRows = [
    { label: 'Subtotal:', value: subtotalValue, bold: false },
    { label: 'ITBIS (18%):', value: invoice.tax || 0, bold: false },
    { label: 'Total Facturado:', value: invoice.total || 0, bold: true },
    ...(paidOrCredited > 0 ? [{ label: 'Pagado / Acreditado:', value: -paidOrCredited, bold: false }] : []),
  ];

  let totalsY = currentY;
  totalRows.forEach((row, index) => {
    doc.setDrawColor(...(row.bold ? COLORS.black : COLORS.subtle));
    doc.setLineWidth(row.bold ? 0.45 : 0.2);
    doc.line(totalsX, totalsY + 3.8, totalsX + totalsWidth, totalsY + 3.8);

    doc.setFont('helvetica', row.bold ? 'bold' : 'normal');
    doc.setFontSize(row.bold ? 11 : 8.8);
    doc.setTextColor(...COLORS.text);
    doc.text(row.label, totalsX + 1, totalsY);
    const prefix = row.value < 0 ? '-$' : '$';
    doc.text(`${prefix}${money(Math.abs(row.value))}`, totalsX + totalsWidth, totalsY, { align: 'right' });
    totalsY += row.bold ? 8 : 6.5;

    if (index === totalRows.length - 1) {
      doc.setDrawColor(...COLORS.black);
      doc.setLineWidth(0.55);
      doc.line(totalsX, totalsY - 1, totalsX + totalsWidth, totalsY - 1);
    }
  });

  totalsY += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...COLORS.black);
  doc.text('TOTAL A PAGAR:', totalsX, totalsY);
  doc.text(`$${money(balanceDue)}`, totalsX + totalsWidth, totalsY, { align: 'right' });

  if (isECFDoc) {
    const qrY = Math.min(totalsY + 10, PAGE_HEIGHT - 56);
    const qrUrl = generateVerificationUrl(
      companyInfo.rnc,
      documentCode,
      invoice.total,
      invoice.date,
      invoice.ecfCodigoSeguridad,
      invoice.clientRnc,
      invoice.ecfFechaFirma,
      invoice.ecfSignedXml
    );
    const { default: QRCode } = await import('qrcode');
    const qrDataUrl = await QRCode.toDataURL(qrUrl);
    doc.addImage(qrDataUrl, 'PNG', MARGIN, qrY, 26, 26);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...COLORS.muted);
    doc.text('Representación impresa de e-CF', MARGIN + 31, qrY + 6);
    doc.text(`Seguridad: ${invoice.ecfCodigoSeguridad || 'N/A'}`, MARGIN + 31, qrY + 11);
  }

  // Footer
  const footerY = PAGE_HEIGHT - 13;
  doc.setDrawColor(...COLORS.subtle);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, footerY - 6, PAGE_WIDTH - MARGIN, footerY - 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.muted);
  doc.text(
    `${companyInfo.name} | RNC: ${companyInfo.rnc} | Santo Domingo, República Dominicana`,
    PAGE_WIDTH / 2,
    footerY,
    { align: 'center' }
  );

  return doc;
}

export async function generateQuotationPDF(quotation: any, companyInfo: any) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  let currentY = 16;

  try {
    doc.addImage('/zarela-logo.png', 'PNG', MARGIN - 2, currentY, 30, 30);
  } catch {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(32);
    doc.setTextColor(4, 39, 85);
    doc.text('Z', MARGIN, currentY + 24);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.black);
  doc.text('COTIZACION', PAGE_WIDTH - MARGIN, currentY + 9, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`No.: ${quotation.number || 'S/N'}`, PAGE_WIDTH - MARGIN, currentY + 19, { align: 'right' });
  doc.text(`Valida hasta: ${safeDate(quotation.validUntil)}`, PAGE_WIDTH - MARGIN, currentY + 26, { align: 'right' });

  const companyY = 56;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.text);
  doc.text(companyInfo.name || 'Zarela ERP', MARGIN, companyY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`RNC: ${companyInfo.rnc || 'N/A'}`, MARGIN, companyY + 8);
  doc.text(doc.splitTextToSize(companyInfo.address || '', 112), MARGIN, companyY + 16);

  const contactLine = [companyInfo.phone, companyInfo.email, companyInfo.instagram].filter(Boolean).join(' | ');
  if (contactLine) {
    doc.text(contactLine, MARGIN, companyY + 24);
  }

  currentY = 84;
  doc.setDrawColor(...COLORS.black);
  doc.setLineWidth(0.7);
  doc.line(MARGIN, currentY, PAGE_WIDTH - MARGIN, currentY);

  const leftX = MARGIN;
  const leftValueX = MARGIN + 38;
  const rightX = 110;
  const rightValueX = 136;
  const rightEnd = PAGE_WIDTH - MARGIN;

  currentY = 96;
  drawSectionTitle(doc, 'Cliente', leftX, currentY, 98);
  drawSectionTitle(doc, 'Detalles', rightX, currentY, rightEnd);

  let clientY = currentY + 10;
  clientY = drawLabelValue(doc, 'Razón Social:', quotation.clientName || 'N/A', leftX, clientY, leftValueX, 58, {
    valueFont: 'bold',
    fontSize: 8.5,
  });
  clientY = drawLabelValue(doc, 'RNC/Cédula:', formatRNC(quotation.clientRnc) || 'N/A', leftX, clientY + 1.5, leftValueX, 58);
  drawLabelValue(doc, 'Dirección:', quotation.clientAddress || 'N/A', leftX, clientY + 1.5, leftValueX, 58);

  let detailY = currentY + 10;
  detailY = drawLabelValue(doc, 'Documento:', 'Cotización', rightX, detailY, rightValueX, 46);
  detailY = drawLabelValue(doc, 'Estado:', quotation.status || 'Borrador', rightX, detailY + 1.5, rightValueX, 46);
  detailY = drawLabelValue(doc, 'Fecha:', safeDate(quotation.date), rightX, detailY + 1.5, rightValueX, 46);
  drawLabelValue(doc, 'Validez:', safeDate(quotation.validUntil), rightX, detailY + 1.5, rightValueX, 46);

  currentY = 147;
  const { default: autoTable } = await import('jspdf-autotable');
  const rows = (quotation.items || []).map((item: any, index: number) => [
    `${index + 1}`,
    item.productName || 'Producto',
    `${Number(item.quantity || 0).toLocaleString('en-US')}`,
    money(item.price || 0),
    money(item.total || item.subtotal || 0),
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: MARGIN, right: MARGIN },
    head: [['#', 'DESCRIPCIÓN', 'CANT', 'PRECIO', 'TOTAL']],
    body: rows,
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 8.8,
      textColor: COLORS.text,
      cellPadding: { top: 5, right: 2, bottom: 5, left: 2 },
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fontStyle: 'bold',
      fontSize: 9,
      textColor: COLORS.black,
      cellPadding: { top: 3, right: 2, bottom: 4, left: 2 },
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'left' },
      1: { cellWidth: 94, halign: 'left', fontStyle: 'bold' },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 28, halign: 'right' },
      4: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
    },
    didDrawCell: (data) => {
      if (data.section === 'head') {
        doc.setDrawColor(...COLORS.black);
        doc.setLineWidth(0.7);
        doc.line(data.cell.x, data.cell.y + data.cell.height + 0.5, data.cell.x + data.cell.width, data.cell.y + data.cell.height + 0.5);
      }

      if (data.section === 'body') {
        doc.setDrawColor(...COLORS.subtle);
        doc.setLineWidth(0.2);
        doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
      }
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  if (quotation.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.text);
    doc.text('Notas / Condiciones:', MARGIN, currentY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const noteLines = doc.splitTextToSize(quotation.notes, 86);
    doc.text(noteLines, MARGIN, currentY + 6);
  }

  const totalsX = 118;
  const totalsWidth = PAGE_WIDTH - MARGIN - totalsX;
  const totalRows = [
    { label: 'Subtotal:', value: quotation.subtotal || (quotation.total - (quotation.tax || 0)), bold: false },
    { label: 'ITBIS:', value: quotation.tax || 0, bold: false },
    { label: 'Total Cotizado:', value: quotation.total || 0, bold: true },
  ];

  let totalsY = currentY;
  totalRows.forEach((row, index) => {
    doc.setDrawColor(...(row.bold ? COLORS.black : COLORS.subtle));
    doc.setLineWidth(row.bold ? 0.45 : 0.2);
    doc.line(totalsX, totalsY + 3.8, totalsX + totalsWidth, totalsY + 3.8);
    doc.setFont('helvetica', row.bold ? 'bold' : 'normal');
    doc.setFontSize(row.bold ? 11 : 8.8);
    doc.setTextColor(...COLORS.text);
    doc.text(row.label, totalsX + 1, totalsY);
    doc.text(`$${money(row.value)}`, totalsX + totalsWidth, totalsY, { align: 'right' });
    totalsY += row.bold ? 8 : 6.5;
    if (index === totalRows.length - 1) {
      doc.setDrawColor(...COLORS.black);
      doc.setLineWidth(0.55);
      doc.line(totalsX, totalsY - 1, totalsX + totalsWidth, totalsY - 1);
    }
  });

  totalsY += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...COLORS.black);
  doc.text('TOTAL:', totalsX, totalsY);
  doc.text(`$${money(quotation.total || 0)}`, totalsX + totalsWidth, totalsY, { align: 'right' });

  const footerY = PAGE_HEIGHT - 13;
  doc.setDrawColor(...COLORS.subtle);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, footerY - 6, PAGE_WIDTH - MARGIN, footerY - 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.muted);
  doc.text(
    `${companyInfo.name || 'Zarela ERP'} | RNC: ${companyInfo.rnc || 'N/A'}`,
    PAGE_WIDTH / 2,
    footerY,
    { align: 'center' }
  );

  return doc;
}
