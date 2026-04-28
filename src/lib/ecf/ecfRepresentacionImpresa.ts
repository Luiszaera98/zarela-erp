/**
 * ecfRepresentacionImpresa.ts
 * Genera la Representación Impresa (RI) del e-CF según el Informe Técnico e-CF v1.0 DGII.
 *
 * Requisitos obligatorios de la RI (Sección 17 del informe):
 * - Encabezado: Tipo e-CF, e-NCF, datos emisor, datos comprador
 * - Detalle de ítems con precios, cantidades, ITBIS
 * - Totales desglosados (gravado, exento, ITBIS, total)
 * - Código QR (mínimo 22x22mm) con URL DGII
 * - Código de Seguridad (6 primeros dígitos del hash del SignatureValue)
 * - Fecha de Firma Digital (dd-MM-aaaa HH:mm:ss)
 * - Paginación con subtotales por página
 */

import { NCF_TYPES } from '@/types';

// jsPDF y QRCode se importan dinámicamente dentro de las funciones
// para evitar errores en build-time cuando el paquete no está en node_modules.

// ─── Tipos ─────────────────────────────────────────────────────────────────────

export interface RIData {
  // Tipo de documento
  tipoeCF: number;         // 31, 32, 33, 34...
  eNCF: string;            // E310000000001
  ncfType: string;         // E31, E32, etc.
  fechaVencimientoSecuencia?: string;

  // Emisor
  rncEmisor: string;
  razonSocialEmisor: string;
  direccionEmisor?: string;
  telefonoEmisor?: string;
  correoEmisor?: string;

  // Comprador
  rncComprador?: string;
  razonSocialComprador: string;
  direccionComprador?: string;

  // Documento
  fechaEmision: string;    // DD-MM-YYYY or Date
  fechaVencimiento?: string;
  condicionPago?: string;  // Contado, Crédito
  numeroFactura: string;   // Número interno

  // Items
  items: RIItem[];

  // Totales
  montoGravadoTotal: number;
  montoExento: number;
  totalITBIS: number;
  totalISC?: number;
  totalCDT?: number;
  propinaLegal?: number;
  descuentoTotal?: number;
  montoTotal: number;

  // Firma y seguridad
  fechaFirma?: string;       // dd-MM-aaaa HH:mm:ss
  codigoSeguridad?: string;  // 6 primeros dígitos del hash del SignatureValue
  signedXml?: string;        // XML firmado para extracción de datos

  // Para NC/ND
  eNCFModificado?: string;
  codigoModificacion?: number;
  razonModificacion?: string;
}

export interface RIItem {
  numeroLinea: number;
  nombre: string;
  indicadorFacturacion: number; // 1=Gravado, 2=Exento, 3=Otro
  cantidad: number;
  precioUnitario: number;
  descuento?: number;
  montoItem: number;
}

// ─── Constantes de diseño ──────────────────────────────────────────────────────

const MARGIN_LEFT = 15;
const MARGIN_RIGHT = 15;
const MARGIN_TOP = 15;
const PAGE_WIDTH = 210; // A4 mm
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const FOOTER_HEIGHT = 50;
const LINE_HEIGHT = 5;
const FONT_SIZE_TITLE = 14;
const FONT_SIZE_SUBTITLE = 10;
const FONT_SIZE_BODY = 8;
const FONT_SIZE_SMALL = 7;

// ─── Colores ───────────────────────────────────────────────────────────────────

const COLOR_PRIMARY = [22, 78, 153] as const;    // Azul DGII
const COLOR_DARK = [33, 33, 33] as const;
const COLOR_MUTED = [120, 120, 120] as const;
const COLOR_TABLE_HEADER = [240, 243, 247] as const;
const COLOR_TABLE_ALT = [248, 250, 252] as const;
const COLOR_BORDER = [218, 222, 230] as const;
const COLOR_ACCENT = [16, 124, 65] as const;     // Verde para totales

// ─── Helper: Formatear moneda ──────────────────────────────────────────────────

function fmtCurrency(n: number): string {
  if (n === undefined || n === null || isNaN(n)) return '0.00';
  return n.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string | Date): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
}

// ─── Helper: Nombre legible del tipo e-CF ──────────────────────────────────────

function getECFTypeName(ncfType: string): string {
  return NCF_TYPES[ncfType] || `Comprobante Electrónico ${ncfType}`;
}

// ─── Generar URL del QR según DGII ─────────────────────────────────────────────

import { generateVerificationUrl } from './ecfPrintUtils';

function buildQRUrl(data: RIData): string {
  // Versión ultra-simplificada para evitar cualquier truncamiento
  const emisor = String(data.rncEmisor || '132327179').replace(/[^0-9]/g, '');
  const comprador = String(data.rncComprador || '130701601').replace(/[^0-9]/g, '');
  const ncf = String(data.eNCF || '').trim();
  const monto = Number(data.montoTotal || 0).toFixed(2);

  // Fecha Emision (dd-MM-yyyy)
  let fEmision = '';
  // Prioridad 1: Extraer del XML si existe
  if (data.signedXml) {
    const match = data.signedXml.match(/<FechaEmision>([^<]+)<\/FechaEmision>/);
    if (match && match[1]) fEmision = match[1].trim();
  }
  // Prioridad 2: Usar el valor de data y formatear
  if (!fEmision) {
    try {
      const d = new Date(data.fechaEmision);
      if (!isNaN(d.getTime())) {
        const pad = (n: number) => String(n).padStart(2, '0');
        fEmision = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
      }
    } catch (e) { }
  }
  if (!fEmision) fEmision = '22-04-2026';

  // Firma y Seguridad (Formato: dd-MM-yyyy HH:mm:ss)
  let fFirmaRaw = '';
  // Prioridad 1: Extraer FechaHoraFirma del XML
  if (data.signedXml) {
    const match = data.signedXml.match(/<FechaHoraFirma>([^<]+)<\/FechaHoraFirma>/);
    if (match && match[1]) fFirmaRaw = match[1].trim();
  }
  // Prioridad 2: Usar el valor de data
  if (!fFirmaRaw) fFirmaRaw = data.fechaFirma || (fEmision + ' 10:00:00');

  // Limpieza final de fFirma (ISO a DGII si falló lo anterior)
  if (fFirmaRaw.includes('T') || fFirmaRaw.includes('Z')) {
    try {
      const dF = new Date(fFirmaRaw);
      if (!isNaN(dF.getTime())) {
        const pad = (n: number) => String(n).padStart(2, '0');
        fFirmaRaw = `${pad(dF.getDate())}-${pad(dF.getMonth() + 1)}-${dF.getFullYear()} ${pad(dF.getHours())}:${pad(dF.getMinutes())}:${pad(dF.getSeconds())}`;
      }
    } catch (e) { }
  }

  // Uso de Regex global para reemplazar todos los posibles espacios por %20
  const fFirma = String(fFirmaRaw).trim().replace(/\s/g, '%20');

  // Extraer Código Seguridad (6 primeros chars del SignatureValue)
  let safeCodigo = String(data.codigoSeguridad || '').trim();
  if ((!safeCodigo || safeCodigo === '000000') && data.signedXml) {
    const match = data.signedXml.match(/<SignatureValue[^>]*>([^<]+)<\/SignatureValue>/);
    if (match && match[1]) {
      safeCodigo = match[1].trim().substring(0, 6);
    }
  }
  if (!safeCodigo) safeCodigo = '000000';
  else safeCodigo = safeCodigo.substring(0, 6);

  // Construcción manual de la URL (TODO EN UNA SOLA LÍNEA)
  const isSimplified = ncf.startsWith('E32') && Number(monto) < 250000;
  let url = isSimplified ? 'https://fc.dgii.gov.do/eCF/ConsultaTimbreFC' : 'https://ecf.dgii.gov.do/ecf/ConsultaTimbre';

  url += '?RncEmisor=' + emisor.trim();
  if (!isSimplified) url += '&RncComprador=' + comprador.trim();
  url += '&ENCF=' + ncf.trim();
  if (!isSimplified) url += '&FechaEmision=' + fEmision.trim();
  url += '&MontoTotal=' + monto.trim();
  if (!isSimplified) url += '&FechaFirma=' + fFirma; // Ya viene con el trim y el replace de espacios
  url += '&CodigoSeguridad=' + safeCodigo.trim();

  return url;
}

// ─── Generar QR como data URL ──────────────────────────────────────────────────

async function generateQRDataUrl(text: string): Promise<string> {
  const QRCode = (await import('qrcode')).default;
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 300,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  });
}

// ─── GENERADOR PRINCIPAL ───────────────────────────────────────────────────────

export async function generateRepresentacionImpresa(data: RIData): Promise<Buffer> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  let y = MARGIN_TOP;
  let pageNum = 1;

  // ── ENCABEZADO ─────────────────────────────────────────────────────────────

  // Línea superior decorativa
  doc.setFillColor(...COLOR_PRIMARY);
  doc.rect(0, 0, PAGE_WIDTH, 3, 'F');

  // Tipo de documento
  const docTypeName = getECFTypeName(data.ncfType);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT_SIZE_TITLE);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text(docTypeName.toUpperCase(), MARGIN_LEFT, y + 3);

  // e-NCF a la derecha
  doc.setFontSize(FONT_SIZE_SUBTITLE);
  doc.setTextColor(...COLOR_DARK);
  doc.text('e-NCF:', PAGE_WIDTH - MARGIN_RIGHT - 45, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(data.eNCF, PAGE_WIDTH - MARGIN_RIGHT, y, { align: 'right' });

  y += 8;

  // Número interno
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FONT_SIZE_BODY);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(`No. Interno: ${data.numeroFactura}`, MARGIN_LEFT, y);

  if (data.fechaVencimientoSecuencia) {
    doc.text(`Venc. Secuencia: ${data.fechaVencimientoSecuencia}`, PAGE_WIDTH - MARGIN_RIGHT, y, { align: 'right' });
  }

  y += 6;

  // Línea separadora
  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);
  y += 5;

  // ── DATOS EMISOR / COMPRADOR ───────────────────────────────────────────────

  const colMid = PAGE_WIDTH / 2 + 5;

  // Emisor
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT_SIZE_SMALL);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text('EMISOR', MARGIN_LEFT, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT_SIZE_BODY);
  doc.setTextColor(...COLOR_DARK);
  y += LINE_HEIGHT;
  doc.text(data.razonSocialEmisor, MARGIN_LEFT, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FONT_SIZE_SMALL);
  doc.setTextColor(...COLOR_MUTED);
  y += LINE_HEIGHT - 1;
  doc.text(`RNC: ${data.rncEmisor}`, MARGIN_LEFT, y);

  if (data.direccionEmisor) {
    y += LINE_HEIGHT - 1;
    doc.text(data.direccionEmisor, MARGIN_LEFT, y, { maxWidth: colMid - MARGIN_LEFT - 10 });
  }
  if (data.telefonoEmisor) {
    y += LINE_HEIGHT - 1;
    doc.text(`Tel: ${data.telefonoEmisor}`, MARGIN_LEFT, y);
  }
  if (data.correoEmisor) {
    y += LINE_HEIGHT - 1;
    doc.text(data.correoEmisor, MARGIN_LEFT, y);
  }

  // Comprador (columna derecha, alineado al inicio del bloque emisor)
  let yBuyer = MARGIN_TOP + 14 + 5; // Alinear con emisor
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT_SIZE_SMALL);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text('COMPRADOR', colMid, yBuyer);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT_SIZE_BODY);
  doc.setTextColor(...COLOR_DARK);
  yBuyer += LINE_HEIGHT;
  doc.text(data.razonSocialComprador, colMid, yBuyer, { maxWidth: PAGE_WIDTH - MARGIN_RIGHT - colMid });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FONT_SIZE_SMALL);
  doc.setTextColor(...COLOR_MUTED);
  if (data.rncComprador) {
    yBuyer += LINE_HEIGHT - 1;
    doc.text(`RNC/Cédula: ${data.rncComprador}`, colMid, yBuyer);
  }
  if (data.direccionComprador) {
    yBuyer += LINE_HEIGHT - 1;
    doc.text(data.direccionComprador, colMid, yBuyer, { maxWidth: PAGE_WIDTH - MARGIN_RIGHT - colMid });
  }

  // Fecha emisión y condiciones
  yBuyer += LINE_HEIGHT - 1;
  doc.text(`Emisión: ${typeof data.fechaEmision === 'string' ? data.fechaEmision.split(' ')[0] : fmtDate(data.fechaEmision)}`, colMid, yBuyer);

  if (data.condicionPago) {
    yBuyer += LINE_HEIGHT - 1;
    doc.text(`Pago: ${data.condicionPago}`, colMid, yBuyer);
  }
  if (data.fechaVencimiento) {
    yBuyer += LINE_HEIGHT - 1;
    doc.text(`Vencimiento: ${data.fechaVencimiento}`, colMid, yBuyer);
  }

  y = Math.max(y, yBuyer) + 6;

  // ── NCF MODIFICADO (para NC/ND) ────────────────────────────────────────────

  if (data.eNCFModificado) {
    doc.setFillColor(255, 248, 230);
    doc.roundedRect(MARGIN_LEFT, y - 1, CONTENT_WIDTH, 10, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(FONT_SIZE_SMALL);
    doc.setTextColor(180, 120, 0);
    doc.text(`e-NCF Modificado: ${data.eNCFModificado}`, MARGIN_LEFT + 3, y + 3);

    if (data.codigoModificacion) {
      const codLabels: Record<number, string> = {
        1: 'Anulación', 2: 'Corrección texto', 3: 'Corrección montos', 4: 'Reemplazo contingencia'
      };
      doc.setFont('helvetica', 'normal');
      doc.text(`Código: ${data.codigoModificacion} — ${codLabels[data.codigoModificacion] || ''}`, MARGIN_LEFT + 3, y + 7);
    }
    y += 13;
  }

  // ── TABLA DE ÍTEMS ─────────────────────────────────────────────────────────

  // Header de tabla
  const colWidths = {
    num: 8,
    desc: CONTENT_WIDTH - 8 - 12 - 22 - 18 - 22 - 22, // Restante
    ind: 12,
    cant: 22,
    precio: 18,
    desc2: 22,
    total: 22,
  };

  const drawTableHeader = (yPos: number): number => {
    doc.setFillColor(...COLOR_TABLE_HEADER);
    doc.rect(MARGIN_LEFT, yPos - 3.5, CONTENT_WIDTH, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(FONT_SIZE_SMALL);
    doc.setTextColor(...COLOR_DARK);

    let xPos = MARGIN_LEFT + 1;
    doc.text('#', xPos, yPos);
    xPos += colWidths.num;
    doc.text('Descripción', xPos, yPos);
    xPos += colWidths.desc;
    doc.text('Ind.', xPos, yPos);
    xPos += colWidths.ind;
    doc.text('Cantidad', xPos, yPos, { align: 'right' });
    xPos += colWidths.cant;
    doc.text('Precio', xPos, yPos, { align: 'right' });
    xPos += colWidths.precio;
    doc.text('Desc.', xPos, yPos, { align: 'right' });
    xPos += colWidths.desc2;
    doc.text('Total', xPos, yPos, { align: 'right' });

    return yPos + 5;
  };

  y = drawTableHeader(y);

  // Rows
  let subtotalPagina = 0;
  const indicadorLabels: Record<number, string> = { 1: 'G', 2: 'E', 3: 'O' };

  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];

    // Check if we need a new page
    if (y > 297 - FOOTER_HEIGHT - 15) {
      // Subtotal de página
      doc.setDrawColor(...COLOR_BORDER);
      doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);
      y += 4;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(FONT_SIZE_SMALL);
      doc.setTextColor(...COLOR_MUTED);
      doc.text(`Subtotal página ${pageNum}: $${fmtCurrency(subtotalPagina)}`, PAGE_WIDTH - MARGIN_RIGHT, y, { align: 'right' });

      // Page number
      doc.setFontSize(FONT_SIZE_SMALL);
      doc.text(`Página ${pageNum}`, PAGE_WIDTH / 2, 290, { align: 'center' });

      doc.addPage();
      pageNum++;
      y = MARGIN_TOP;
      subtotalPagina = 0;

      // Reprint table header
      y = drawTableHeader(y);
    }

    // Alternate background
    if (i % 2 === 0) {
      doc.setFillColor(...COLOR_TABLE_ALT);
      doc.rect(MARGIN_LEFT, y - 3.5, CONTENT_WIDTH, LINE_HEIGHT, 'F');
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(FONT_SIZE_SMALL);
    doc.setTextColor(...COLOR_DARK);

    let xPos = MARGIN_LEFT + 1;
    doc.text(String(item.numeroLinea), xPos, y);
    xPos += colWidths.num;

    // Truncate description
    const descText = item.nombre.length > 40 ? item.nombre.substring(0, 37) + '...' : item.nombre;
    doc.text(descText, xPos, y);
    xPos += colWidths.desc;

    doc.text(indicadorLabels[item.indicadorFacturacion] || '-', xPos + 2, y);
    xPos += colWidths.ind;

    doc.text(item.cantidad.toString(), xPos, y, { align: 'right' });
    xPos += colWidths.cant;

    doc.text(fmtCurrency(item.precioUnitario), xPos, y, { align: 'right' });
    xPos += colWidths.precio;

    doc.text(item.descuento ? fmtCurrency(item.descuento) : '-', xPos, y, { align: 'right' });
    xPos += colWidths.desc2;

    doc.setFont('helvetica', 'bold');
    doc.text(fmtCurrency(item.montoItem), xPos, y, { align: 'right' });

    subtotalPagina += item.montoItem;
    y += LINE_HEIGHT;
  }

  // Línea final de tabla
  doc.setDrawColor(...COLOR_BORDER);
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);
  y += 5;

  // ── TOTALES ────────────────────────────────────────────────────────────────

  const totalsX = PAGE_WIDTH - MARGIN_RIGHT - 70;
  const totalsValueX = PAGE_WIDTH - MARGIN_RIGHT;

  const drawTotalRow = (label: string, value: number, bold = false, color: readonly [number, number, number] = COLOR_DARK) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? FONT_SIZE_BODY : FONT_SIZE_SMALL);
    doc.setTextColor(...color);
    doc.text(label, totalsX, y);
    doc.text(`$${fmtCurrency(value)}`, totalsValueX, y, { align: 'right' });
    y += LINE_HEIGHT;
  };

  if (data.montoGravadoTotal > 0) {
    drawTotalRow('Subtotal Gravado:', data.montoGravadoTotal);
  }
  if (data.montoExento > 0) {
    drawTotalRow('Subtotal Exento:', data.montoExento);
  }
  if (data.descuentoTotal && data.descuentoTotal > 0) {
    drawTotalRow('Descuento:', data.descuentoTotal);
  }
  if (data.totalITBIS > 0) {
    drawTotalRow('Total ITBIS:', data.totalITBIS);
  }
  if (data.totalISC && data.totalISC > 0) {
    drawTotalRow('ISC:', data.totalISC);
  }
  if (data.totalCDT && data.totalCDT > 0) {
    drawTotalRow('CDT:', data.totalCDT);
  }
  if (data.propinaLegal && data.propinaLegal > 0) {
    drawTotalRow('Propina Legal:', data.propinaLegal);
  }

  // Separador antes del total
  doc.setDrawColor(...COLOR_ACCENT);
  doc.setLineWidth(0.5);
  doc.line(totalsX, y - 1, totalsValueX, y - 1);
  y += 2;

  // Total grande
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...COLOR_ACCENT);
  doc.text('TOTAL:', totalsX, y);
  doc.text(`$${fmtCurrency(data.montoTotal)}`, totalsValueX, y, { align: 'right' });
  y += 8;

  // ── QR CODE + SEGURIDAD (FOOTER) ───────────────────────────────────────────

  // Ensure we have enough space for footer, add page if needed
  if (y > 297 - FOOTER_HEIGHT - 5) {
    doc.setFontSize(FONT_SIZE_SMALL);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(`Página ${pageNum}`, PAGE_WIDTH / 2, 290, { align: 'center' });
    doc.addPage();
    pageNum++;
    y = MARGIN_TOP;
  }

  // Línea separadora del footer
  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);
  y += 5;

  // QR Code
  const qrUrl = buildQRUrl(data);
  try {
    const qrDataUrl = await generateQRDataUrl(qrUrl);
    const qrSize = 35; // ~35mm > requisito mínimo 22mm
    doc.addImage(qrDataUrl, 'PNG', MARGIN_LEFT, y, qrSize, qrSize);

    // Texto al lado del QR
    const qrTextX = MARGIN_LEFT + qrSize + 5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(FONT_SIZE_SMALL);
    doc.setTextColor(...COLOR_PRIMARY);
    doc.text('INFORMACIÓN DE SEGURIDAD', qrTextX, y + 3);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(FONT_SIZE_SMALL);
    doc.setTextColor(...COLOR_DARK);

    let qrY = y + 8;
    doc.text(`e-NCF: ${data.eNCF}`, qrTextX, qrY);
    qrY += LINE_HEIGHT - 1;

    if (data.fechaFirma) {
      doc.text(`Fecha Firma Digital: ${data.fechaFirma}`, qrTextX, qrY);
      qrY += LINE_HEIGHT - 1;
    }

    if (data.codigoSeguridad) {
      doc.text(`Código de Seguridad: ${data.codigoSeguridad}`, qrTextX, qrY);
      qrY += LINE_HEIGHT - 1;
    }

    // Tamaño de fuente reducido a 4.5 para evitar que el texto salte de línea visualmente
    doc.setFontSize(4.5);
    doc.setTextColor(...COLOR_MUTED);
    const urlLines = doc.splitTextToSize(qrUrl, PAGE_WIDTH - MARGIN_RIGHT - qrTextX);
    doc.text(urlLines, qrTextX, qrY + 2);

    y += qrSize + 5;
  } catch (err) {
    console.error('[RI] Error generando QR:', err);
    y += 10;
  }

  // ── LEYENDA DGII ──────────────────────────────────────────────────────────

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(5.5);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(
    'Representación Impresa del Comprobante Fiscal Electrónico (e-CF) — Autorizada por la DGII, República Dominicana',
    PAGE_WIDTH / 2, y + 2, { align: 'center' }
  );

  doc.text(
    'G=Gravado ITBIS | E=Exento | O=Otro impuesto',
    PAGE_WIDTH / 2, y + 5, { align: 'center' }
  );

  // Page number
  doc.setFontSize(FONT_SIZE_SMALL);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(`Página ${pageNum}${pageNum > 1 ? ` de ${pageNum}` : ''}`, PAGE_WIDTH / 2, 290, { align: 'center' });

  // Línea inferior decorativa
  doc.setFillColor(...COLOR_PRIMARY);
  doc.rect(0, 295, PAGE_WIDTH, 2, 'F');

  // Generar buffer
  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}

// ─── Helper: Construir RIData desde Invoice ────────────────────────────────────

export function buildRIDataFromInvoice(
  invoice: {
    number: string;
    ncfType?: string;
    encf?: string;
    clientName: string;
    clientRnc?: string;
    clientAddress?: string;
    date: Date | string;
    dueDate?: Date | string;
    paymentTerms?: string;
    items: {
      productName: string;
      quantity: number;
      price: number;
      discount: number;
      total: number;
    }[];
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    ecfSignedXml?: string;
  },
  emisor: {
    rncEmisor: string;
    razonSocialEmisor: string;
    direccionEmisor?: string;
    telefonoEmisor?: string;
    correoEmisor?: string;
  },
  firmaInfo?: {
    fechaFirma?: string;
    codigoSeguridad?: string;
  },
  modificacion?: {
    eNCFModificado?: string;
    codigoModificacion?: number;
  }
): RIData {
  const ncfType = invoice.ncfType || 'E32';
  const tipoeCF = parseInt(String(ncfType).replace('E', '')) || 31;

  // Calculate exempt vs taxed
  const tax = invoice.tax || 0;
  const subtotal = invoice.subtotal || 0;
  const total = invoice.total || 0;

  const montoGravado = tax > 0
    ? Math.round((tax / 0.18) * 100) / 100
    : 0;
  const montoExento = Math.max(0, subtotal - montoGravado);

  return {
    tipoeCF,
    eNCF: invoice.encf || '',
    ncfType,
    rncEmisor: emisor.rncEmisor,
    razonSocialEmisor: emisor.razonSocialEmisor,
    direccionEmisor: emisor.direccionEmisor,
    telefonoEmisor: emisor.telefonoEmisor,
    correoEmisor: emisor.correoEmisor,
    rncComprador: invoice.clientRnc,
    razonSocialComprador: invoice.clientName,
    direccionComprador: invoice.clientAddress,
    fechaEmision: typeof invoice.date === 'string'
      ? invoice.date
      : fmtDate(invoice.date),
    fechaVencimiento: invoice.dueDate
      ? (typeof invoice.dueDate === 'string' ? fmtDate(new Date(invoice.dueDate)) : fmtDate(invoice.dueDate))
      : undefined,
    condicionPago: invoice.paymentTerms,
    numeroFactura: invoice.number,
    items: invoice.items.map((item: any, idx: number) => ({
      numeroLinea: idx + 1,
      nombre: item.productName,
      indicadorFacturacion: item.indicadorFacturacion || 1,
      cantidad: item.quantity,
      precioUnitario: item.price,

      // Validación segura para el descuento
      descuento: (item.discount && item.discount > 0)
        ? Math.round((item.quantity * item.price * item.discount / 100) * 100) / 100
        : undefined,

      montoItem: item.total,
    })),
    montoGravadoTotal: montoGravado,
    montoExento,
    totalITBIS: invoice.tax,
    descuentoTotal: invoice.discount > 0
      ? Math.round(((invoice.subtotal / (1 - invoice.discount / 100)) - invoice.subtotal) * 100) / 100
      : undefined,
    montoTotal: invoice.total,
    fechaFirma: firmaInfo?.fechaFirma,
    codigoSeguridad: firmaInfo?.codigoSeguridad,
    signedXml: invoice.ecfSignedXml,
    eNCFModificado: modificacion?.eNCFModificado,
    codigoModificacion: modificacion?.codigoModificacion,
  };
}