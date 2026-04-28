/**
 * ecfTransformer.ts
 * Convierte los datos de una factura del ERP al formato JSON requerido
 * por la librería dgii-ecf (que a su vez genera el XML del e-CF).
 *
 * Referencia: Informe Técnico e-CF v1.0 de la DGII - República Dominicana
 * Tipos soportados:
 *   E31 - Factura de Crédito Fiscal Electrónica
 *   E32 - Factura de Consumo Electrónica
 *   E33 - Nota de Débito Electrónica
 *   E34 - Nota de Crédito Electrónica
 *   E41 - Comprobante de Compras
 *   E43 - Comprobante Electrónico Gastos Menores
 *   E44 - Regímenes Especiales Electrónico
 *   E45 - Gubernamental Electrónico
 *   E46 - Exportaciones Electrónico
 *   E47 - Pagos al Exterior Electrónico
 *
 * Fase 5 y 6: Soporte múltiples tasas, contingencia y todos los tipos e-CF.
 */

import { Invoice, InvoiceItem, Expense } from '@/types';

// ─── Tasas ITBIS según DGII ───────────────────────────────────────────────────

const ITBIS_RATE_1 = 18; // Tasa 1: 18% (estándar)
const ITBIS_RATE_2 = 16; // Tasa 2: 16%
const ITBIS_RATE_3 = 0;    // Tasa 3: exento
 
/** Límite de monto para comprobante de consumo sin identificación (250,000 DOP) */
const RFCE_THRESHOLD = 250000;

// ─── Helpers de Formateo Crítico para DGII ────────────────────────────────────

/**
 * Formatea un número como string con exactamente 2 decimales.
 * Requerido para evitar errores de cuadratura (1934) en fase de certificación.
 */
const f = (n: number | undefined): string | undefined => {
  if (n === undefined || n === null) return undefined;
  return n.toFixed(2);
};

/**
 * Formatea un número como string entero.
 */
const fs = (n: number | undefined): string | undefined => {
  if (n === undefined || n === null) return undefined;
  return String(n);
};

// ─── Tipos internos ────────────────────────────────────────────────────────────

export interface EcfEmissor {
  RNCEmisor: string;
  RazonSocialEmisor: string;
  DireccionEmisor?: string;
  TelefonoEmisor?: string;
  CorreoEmisor?: string;
  [key: string]: any;
}

interface EcfComprador {
  RNCComprador?: string;
  RazonSocialComprador?: string;
  DireccionComprador?: string;
  [key: string]: any;
}

interface EcfItem {
  NumeroLinea: number;
  NombreItem: string;
  IndicadorFacturacion: number; // 1=Gravado ITBIS 18%, 2=Exento, 3=Gravado 16%
  CantidadItem: number;
  UnidadMedidaItem?: number; // 1=Unidad por defecto
  PrecioUnitarioItem: number;  
  DescuentoMonto?: number;
  TablaSubDescuento?: any;
  MontoItem: number;
  [key: string]: any;
}

// ─── Opciones para el factory ──────────────────────────────────────────────────

export interface ECFBuildOptions {
  /** e-NCF de la factura original que se modifica (para E33, E34) */
  encfAfectado?: string;
  /**
   * Código de modificación según DGII (para E33, E34):
   * 1 = Anula el NCF modificado
   * 2 = Corrige texto del comprobante fiscal modificado
   * 3 = Corrige montos del NCF modificado
   * 4 = Reemplazo NCF emitido en contingencia
   */
  codigoModificacion?: 1 | 2 | 3 | 4;
  /** Descripción libre de la razón de corrección */
  razonCorreccion?: string;
  /**
   * Fecha de vencimiento de la secuencia autorizada (formato DD-MM-YYYY).
   * Por defecto: 31 de diciembre del año siguiente al actual.
   */
  fechaVencimientoSecuencia?: string;
  /** Indica que es una factura de contingencia (emitida con serie B que reemplaza) */
  esContingencia?: boolean;
  /** e-NCF de contingencia que se reemplaza */
  ncfContingencia?: string;
  /** Fecha de la factura original que se modifica */
  fechaNCFModificado?: Date | string;
}

// ─── Helper: Determinar indicador de facturación ───────────────────────────────

function getIndicadorFacturacion(item: InvoiceItem): number {
  // Si el item tiene indicadorFacturacion explícito, usarlo
  if (item.indicadorFacturacion) return item.indicadorFacturacion;
  // Default: 1 = Gravado ITBIS 18%
  return 1;
}

// ─── Helper: Obtener tasa ITBIS del item ──────────────────────────────────────

function getItemITBISRate(item: InvoiceItem): number {
  if (item.itbisRate !== undefined) return item.itbisRate;
  const ind = getIndicadorFacturacion(item);
  switch (ind) {
    case 1: return ITBIS_RATE_1; // 18%
    case 2: return ITBIS_RATE_3; // Exento
    case 3: return ITBIS_RATE_2; // 16%
    default: return ITBIS_RATE_1;
  }
}

// ─── Helper: Formatear fecha para e-CF (DD-MM-YYYY HH:mm:ss) ─────────────────

function formatECFDate(date: Date | string | undefined | null): string {
  if (!date) date = new Date();
  const d = typeof date === 'string' ? new Date(date) : date;
  // Check if invalid date
  if (isNaN(d.getTime())) return formatECFDate(new Date());
  
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// ─── Helper: Formatear solo fecha (DD-MM-YYYY) ────────────────────────────────

function formatECFDateOnly(date: Date | string | undefined | null): string {
  if (!date) date = new Date();
  const d = typeof date === 'string' ? new Date(date) : date;
  // Check if invalid date
  if (isNaN(d.getTime())) return formatECFDateOnly(new Date());
  
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

// ─── Helper: Limpiar propiedades undefined de un objeto ────────────────────────
function clean(obj: any) {
  for (const key of Object.keys(obj)) {
    if (obj[key] === undefined || obj[key] === null || obj[key] === '') {
      delete obj[key];
    }
  }
}

// ─── Helper: Calcular fecha vencimiento secuencia por defecto ──────────────────

function getDefaultFechaVencimientoSecuencia(): string {
  const configuredValue =
    process.env.ECF_FECHA_VENCIMIENTO_SECUENCIA?.trim() ||
    process.env.NEXT_PUBLIC_ECF_FECHA_VENCIMIENTO_SECUENCIA?.trim();

  if (configuredValue) {
    return configuredValue;
  }

  // En las pruebas de certificacion de DGII que ya validaste manualmente,
  // la secuencia autorizada viene con vencimiento a dos anos vista
  // (por ejemplo, en 2026 la DGII esta aceptando 31-12-2028).
  const authorizedYear = new Date().getFullYear() + 2;
  return `31-12-${authorizedYear}`;
}

// ─── Helper: Calcular totales ITBIS desglosados por tasa ──────────────────────

interface ITBISTotals {
  // Tasa 1 (18%)
  MontoGravadoI1: number;
  TotalITBIS1: number;
  // Tasa 2 (16%)
  MontoGravadoI2: number;
  TotalITBIS2: number;
  // Exento
  MontoExento: number;
  // Consolidados
  MontoGravadoTotal: number;
  TotalITBIS: number;
}

export function calcITBISTotals(items: InvoiceItem[], fallbackTaxTotal: number, tipoeCF: number): ITBISTotals {
  let montoGravadoI1 = 0; // 18%
  let montoGravadoI2 = 0; // 16%
  let montoExento = 0;
  let totalITBIS1 = 0;
  let totalITBIS2 = 0;

  // REGLA DE NEGOCIO DGII: Si es tipo 44, 45 o 46, todo es exento por régimen especial (Indicador 4)
  const isSpecialRegime = [44, 45, 46].includes(tipoeCF);

  // Check if items have per-item ITBIS data
  const hasPerItemData = items.some(item => item.indicadorFacturacion !== undefined || item.itbisRate !== undefined);

  if (hasPerItemData) {
    // Calculate from per-item data
    for (const item of items) {
      let ind = getIndicadorFacturacion(item);
      let rateInt = getItemITBISRate(item);
      
      // Override para Regímenes Especiales / Gobierno / Exportación
      if (isSpecialRegime) {
        ind = 4;
        rateInt = 0;
      }
      
      const rate = rateInt / 100;

      // Lógica de Cuadratura: Redondear línea por línea
      const gross = Math.round((item.quantity * item.price) * 100) / 100;
      const discount = item.discount > 0
        ? Math.round((gross * (item.discount / 100)) * 100) / 100
        : 0;
      const net = Math.round((gross - discount) * 100) / 100;
      
      const itbisAmount = isSpecialRegime ? 0 : (item.itbisAmount ?? Math.round((net * rate) * 100) / 100);

      switch (ind) {
        case 1: // 18%
          montoGravadoI1 += net;
          totalITBIS1 += itbisAmount;
          break;
        case 3: // 16%
          montoGravadoI2 += net;
          totalITBIS2 += itbisAmount;
          break;
        case 2: // Exento General
        case 4: // Exento Régimen Especial
        default:
          montoExento += net;
          break;
      }
    }
  } else {
    // Fallback: derive from total tax (backward compatibility)
    if (fallbackTaxTotal > 0) {
      // ITBIS_RATE_1 es 18, dividimos por 100 para la matemática
      const rate = ITBIS_RATE_1 / 100;
      montoGravadoI1 = Math.round((fallbackTaxTotal / rate) * 100) / 100;
      totalITBIS1 = fallbackTaxTotal;
    }
    // Everything not gravado is exento
    const totalItems = items.reduce((sum, i) => sum + i.total, 0);
    montoExento = Math.max(0, totalItems - montoGravadoI1);
  }

  // Round all values
  montoGravadoI1 = Math.round(montoGravadoI1 * 100) / 100;
  montoGravadoI2 = Math.round(montoGravadoI2 * 100) / 100;
  montoExento = Math.round(montoExento * 100) / 100;
  totalITBIS1 = Math.round(totalITBIS1 * 100) / 100;
  totalITBIS2 = Math.round(totalITBIS2 * 100) / 100;

  return {
    MontoGravadoI1: montoGravadoI1,
    TotalITBIS1: totalITBIS1,
    MontoGravadoI2: montoGravadoI2,
    TotalITBIS2: totalITBIS2,
    MontoExento: montoExento,
    MontoGravadoTotal: montoGravadoI1 + montoGravadoI2,
    TotalITBIS: totalITBIS1 + totalITBIS2,
  };
}

// ─── Helper: Construir bloque Totales ─────────────────────────────────────────

function buildTotalesBlock(itbis: ITBISTotals, total: number, discount?: number) {
  const totales: any = {};
 
  if (itbis.MontoGravadoTotal > 0) {
    totales.MontoGravadoTotal = f(itbis.MontoGravadoTotal);
  }

  if (itbis.MontoGravadoI1 > 0) {
    totales.MontoGravadoI1 = f(itbis.MontoGravadoI1);
  }

  if (itbis.MontoGravadoI2 > 0) {
    totales.MontoGravadoI2 = f(itbis.MontoGravadoI2);
  }
 
  if (itbis.MontoExento > 0) {
    totales.MontoExento = f(itbis.MontoExento);
  }
   
  if (itbis.TotalITBIS1 > 0) {
    totales.ITBIS1 = fs(ITBIS_RATE_1);
  }
 
  if (itbis.TotalITBIS2 > 0) {
    totales.ITBIS2 = fs(ITBIS_RATE_2);
  }
 
  // IMPORTANT: TotalITBIS MUST come AFTER ITBIS1 and ITBIS2 in XSD order
  if (itbis.TotalITBIS > 0) {
    totales.TotalITBIS = f(itbis.TotalITBIS);
  }
 
  if (itbis.TotalITBIS1 > 0) {
    totales.TotalITBIS1 = f(itbis.TotalITBIS1);
  }
 
  if (itbis.TotalITBIS2 > 0) {
    totales.TotalITBIS2 = f(itbis.TotalITBIS2);
  }
 
  // DGII valida que MontoTotal = MontoGravadoTotal + MontoExento + TotalITBIS
  // Aseguramos precisión de 2 decimales
  const calculatedTotal = Math.round((itbis.MontoGravadoTotal + itbis.MontoExento + itbis.TotalITBIS) * 100) / 100;
  totales.MontoTotal = f(calculatedTotal);
 
  if (discount && discount > 0) {
    totales.DescuentoTotal = f(discount);
  }
 
  clean(totales);
  return totales;
}

// ─── Transformar items ─────────────────────────────────────────────────────────

function transformItems(items: InvoiceItem[], tipoeCF: number): EcfItem[] {
  const isSpecialRegime = [44, 45, 46].includes(tipoeCF);

  return items.map((item, idx) => {
    const gross = Math.round((item.quantity * item.price) * 100) / 100;
    const discount = item.discount > 0
      ? Math.round((gross * (item.discount / 100)) * 100) / 100
      : 0;

    let indicador = getIndicadorFacturacion(item);
    if (isSpecialRegime) {
      indicador = 4; // Exento por Regímenes Especiales
    }

    // El orden de las propiedades en el objeto determina el orden de los tags en el XML.
    // La secuencia debe ser: NumeroLinea, IndicadorFacturacion, Retencion (opcional), NombreItem...
    const res: any = {
      NumeroLinea: idx + 1,
      IndicadorFacturacion: indicador,
      // Retencion: se añade si existe en el item (opcional para facturas estándar)
      ...(item as any).retencion ? { Retencion: (item as any).retencion } : {},
      NombreItem: item.productName.substring(0, 80), // Max 80 chars
      IndicadorBienoServicio: 1, // 1=Bien, 2=Servicio
      CantidadItem: item.quantity,
      UnidadMedida: 1, // 1=Unidad
      PrecioUnitarioItem: f(item.price),
    };

    if (discount > 0) {
      res.DescuentoMonto = f(discount);
    }

    res.MontoItem = f(gross);

    return res;
  });
}

// ─── Bloque Emisor reutilizable ────────────────────────────────────────────────

function buildEmisorBlock(emisor: EcfEmissor, fechaEmision: string) {
  const emisorObj: any = {
    RNCEmisor: emisor.RNCEmisor,
    RazonSocialEmisor: emisor.RazonSocialEmisor,
    NombreComercial: emisor.NombreComercial || emisor.RazonSocialEmisor,
    Sucursal: emisor.Sucursal || '001',
    DireccionEmisor: emisor.DireccionEmisor || '',
    Municipio: emisor.Municipio || '',
    Provincia: emisor.Provincia || '',
    TablaTelefonoEmisor: emisor.TelefonoEmisor ? { TelefonoEmisor: [emisor.TelefonoEmisor] } : undefined,
    CorreoEmisor: emisor.CorreoEmisor || '',
    FechaEmision: fechaEmision, // Pasamos la fecha ya formateada (solo fecha)
  };
  
  // No limpiar campos mandatorios aunque estén vacíos (aunque lo ideal es que tengan valor)
  // DGII rechazará si DireccionEmisor no está presente en el XML.
  if (!emisorObj.DireccionEmisor) emisorObj.DireccionEmisor = 'N/A';
  if (!emisorObj.Municipio) emisorObj.Municipio = 'N/A';
  if (!emisorObj.Provincia) emisorObj.Provincia = 'N/A';

  clean(emisorObj);
  return emisorObj;
}

function sanitizeIdDocForTipo(tipo: ECFDocType, idDoc: any) {
  if (!idDoc) return;

  switch (tipo) {
    case 'E33':
    case 'E34':
      // El IndicadorMontoGravado es CONDICIONAL para notas de ajuste (E33, E34).
      // Se debe incluir solo si existen ítems gravados.
      if (idDoc.IndicadorMontoGravado === undefined) {
        delete idDoc.IndicadorMontoGravado;
      }
      break;
    case 'E41':
      delete idDoc.IndicadorEnvioDiferido;
      delete idDoc.TipoIngresos;
      delete idDoc.FechaLimitePago;
      delete idDoc.TerminoPago;
      break;
    case 'E43':
      delete idDoc.IndicadorEnvioDiferido;
      delete idDoc.IndicadorMontoGravado;
      delete idDoc.TipoIngresos;
      delete idDoc.TipoPago;
      break;
    case 'E44':
      delete idDoc.IndicadorEnvioDiferido;
      delete idDoc.IndicadorMontoGravado;
      delete idDoc.FechaLimitePago;
      delete idDoc.TerminoPago;
      break;
    case 'E45':
      delete idDoc.IndicadorEnvioDiferido;
      idDoc.IndicadorMontoGravado = 1;
      delete idDoc.FechaLimitePago;
      delete idDoc.TerminoPago;
      break;
    case 'E46':
      delete idDoc.IndicadorEnvioDiferido;
      delete idDoc.IndicadorMontoGravado;
      delete idDoc.FechaLimitePago;
      delete idDoc.TerminoPago;
      break;
    case 'E47':
      delete idDoc.IndicadorEnvioDiferido;
      delete idDoc.IndicadorMontoGravado;
      break;
    default:
      break;
  }

  clean(idDoc);
}

// ─── Helper: Calcular descuento total como monto ──────────────────────────────

function calcDiscountAmount(subtotal: number, discountPercent: number): number | undefined {
  if (discountPercent <= 0) return undefined;
  return Math.round(((subtotal / (1 - discountPercent / 100)) - subtotal) * 100) / 100;
}

// ─── E31: Factura de Crédito Fiscal Electrónica ───────────────────────────────

export function buildE31Json(
  invoice: Invoice,
  encf: string,
  emisor: EcfEmissor,
  options?: ECFBuildOptions
): object {
  const now = new Date();
  const itbis = calcITBISTotals(invoice.items, invoice.tax, 31);
  const fechaVenc = options?.fechaVencimientoSecuencia || getDefaultFechaVencimientoSecuencia();
  const discountAmount = calcDiscountAmount(invoice.subtotal, invoice.discount);

  const idDoc: any = {
    TipoeCF: 31,
    eNCF: encf,
    FechaVencimientoSecuencia: fechaVenc,
    // En certificacion DGII para E31 solo esta autorizando el valor 1.
    IndicadorEnvioDiferido: 1,
    IndicadorMontoGravado: 0,
    TipoIngresos: "01", // 01=Ingresos por Operaciones
    TipoPago: 1,        // 1=Contado, 2=Crédito
    FechaLimitePago: formatECFDateOnly(invoice.dueDate),
    TerminoPago: invoice.paymentTerms || '30 Días',
  };

  // Contingencia
  if (options?.esContingencia && options.ncfContingencia) {
    idDoc.eNCFModificado = options.ncfContingencia;
    idDoc.CodigoModificacion = 4;
  }
  clean(idDoc);

  const comprador: any = {
    RNCComprador: invoice.clientRnc || '',
    RazonSocialComprador: invoice.clientName,
    DireccionComprador: invoice.clientAddress || '',
  };
  clean(comprador);

  return {
    ECF: {
      Encabezado: {
        Version: '1.0',
        IdDoc: idDoc,
        Emisor: buildEmisorBlock(emisor, formatECFDateOnly(invoice.date || now)),
        Comprador: Object.keys(comprador).length > 0 ? comprador : undefined,
        Totales: buildTotalesBlock(itbis, invoice.total, discountAmount),
      },
      DetallesItems: {
        Item: transformItems(invoice.items, 31),
      },
      FechaHoraFirma: formatECFDate(now),
    },
  };
}

// ─── E32: Factura de Consumo Electrónica ──────────────────────────────────────

export function buildE32Json(
  invoice: Invoice,
  encf: string,
  emisor: EcfEmissor,
  options?: ECFBuildOptions
): object {
  const now = new Date();
  const itbis = calcITBISTotals(invoice.items, invoice.tax, 32);

  // E32 NO usa FechaVencimientoSecuencia (solo aplica para E31)
  const idDoc: any = {
    TipoeCF: 32,
    eNCF: encf,
    IndicadorEnvioDiferido: 1,
    IndicadorMontoGravado: 0,
    TipoIngresos: "01",
    TipoPago: 1, // E32 = Factura de Consumo, siempre Contado
  };

  // Contingencia
  if (options?.esContingencia && options.ncfContingencia) {
    idDoc.eNCFModificado = options.ncfContingencia;
    idDoc.CodigoModificacion = 4;
  }
  clean(idDoc);

  const comprador: any = {
    RNCComprador: invoice.clientRnc || '',
    RazonSocialComprador: invoice.clientName,
    DireccionComprador: invoice.clientAddress || '',
  };
  clean(comprador);

  return {
    ECF: {
      Encabezado: {
        Version: '1.0',
        IdDoc: idDoc,
        Emisor: buildEmisorBlock(emisor, formatECFDateOnly(invoice.date || now)),
        Comprador: Object.keys(comprador).length > 0 ? comprador : undefined,
        Totales: buildTotalesBlock(itbis, invoice.total),
      },
      DetallesItems: {
        Item: transformItems(invoice.items, 32),
      },
      FechaHoraFirma: formatECFDate(now),
    },
  };
}

// ─── E33: Nota de Débito Electrónica ──────────────────────────────────────────

export function buildE33Json(
  invoice: Invoice,
  encf: string,
  encfAfectado: string,
  emisor: EcfEmissor,
  options?: ECFBuildOptions
): object {
  const now = new Date();
  const itbis = calcITBISTotals(invoice.items, invoice.tax, 33);
  const fechaVenc = options?.fechaVencimientoSecuencia || getDefaultFechaVencimientoSecuencia();
  const codigoMod = options?.codigoModificacion || 3;

  const idDoc: any = {
    TipoeCF: 33,
    eNCF: encf,
    FechaVencimientoSecuencia: fechaVenc,
    IndicadorMontoGravado: itbis.MontoGravadoTotal > 0 ? 0 : undefined,
    TipoIngresos: "01",
    TipoPago: 1,
  };
  clean(idDoc);

  const infoRef: any = {
    NCFModificado: encfAfectado || 'E310000000001',
    FechaNCFModificado: formatECFDateOnly(options?.fechaNCFModificado || invoice.date || now),
    CodigoModificacion: codigoMod,
    RazonModificacion: options?.razonCorreccion || (invoice as any).reason || 'Ajuste de montos',
  };
  clean(infoRef);

  const comprador: any = {
    RNCComprador: invoice.clientRnc || '',
    RazonSocialComprador: invoice.clientName,
  };
  clean(comprador);

  return {
    ECF: {
      Encabezado: {
        Version: '1.0',
        IdDoc: idDoc,
        Emisor: buildEmisorBlock(emisor, formatECFDateOnly(invoice.date || now)),
        Comprador: Object.keys(comprador).length > 0 ? comprador : undefined,
        Totales: buildTotalesBlock(itbis, invoice.total),
      },
      DetallesItems: {
        Item: transformItems(invoice.items, 33),
      },
      InformacionReferencia: Object.keys(infoRef).length > 0 ? infoRef : undefined,
      FechaHoraFirma: formatECFDate(now),
    },
  };
}

// ─── E34: Nota de Crédito Electrónica ─────────────────────────────────────────

/**
 * Escapa caracteres XML prohibidos en descripciones de productos.
 * Previene errores de parseo en el XML firmado.
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Transforma ítems específicamente para Notas de Crédito (E34).
 * Orden estricto XSD: NumeroLinea, IndicadorFacturacion, NombreItem,
 * CantidadItem, PrecioUnitarioItem, MontoItem.
 * NO incluye: Retencion, IndicadorBienoServicio, UnidadMedida, DescuentoMonto.
 * Todos los montos son POSITIVOS (el tipo 34 ya indica que son créditos).
 */
function transformCreditNoteItems(items: InvoiceItem[]): any[] {
  return items.map((item, idx) => {
    const gross = Math.round((item.quantity * item.price) * 100) / 100;
    const discount = item.discount > 0
      ? Math.round((gross * (item.discount / 100)) * 100) / 100
      : 0;
    const net = Math.round((gross - discount) * 100) / 100;

    const indicador = getIndicadorFacturacion(item);

    return {
      NumeroLinea: idx + 1,
      IndicadorFacturacion: indicador,
      NombreItem: escapeXml(item.productName.substring(0, 80)),
      IndicadorBienoServicio: 1, // 1=Bien, 2=Servicio (OBLIGATORIO antes de CantidadItem)
      CantidadItem: item.quantity,
      PrecioUnitarioItem: f(item.price),
      MontoItem: f(net),
    };
  });
}

export function buildE34Json(
  invoice: Invoice,
  encf: string,
  encfAfectado: string,
  emisor: EcfEmissor,
  options?: ECFBuildOptions
): object {
  const now = new Date();
  const itbis = calcITBISTotals(invoice.items, invoice.tax, 34);
  const codigoMod = options?.codigoModificacion || 1;

  // ─── Calcular IndicadorNotaCredito (regla de 30 días) ───────────────────
  // 0 = La factura original tiene ≤ 30 días calendario
  // 1 = La factura original tiene > 30 días calendario
  const fechaOriginal = options?.fechaNCFModificado
    ? new Date(options.fechaNCFModificado)
    : (invoice.date ? new Date(invoice.date) : now);
  const diffMs = now.getTime() - fechaOriginal.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const indicadorNotaCredito = diffDays > 30 ? 1 : 0;

  // ─── IdDoc: Identificación del documento ────────────────────────────────
  // E34 NO usa FechaVencimientoSecuencia (solo aplica para facturas originales)
  const idDoc: any = {
    TipoeCF: 34,
    eNCF: encf,
    IndicadorNotaCredito: indicadorNotaCredito,
    IndicadorMontoGravado: itbis.MontoGravadoTotal > 0 ? 0 : undefined,
    TipoIngresos: "01",
    TipoPago: 1,
  };
  clean(idDoc);

  // ─── InformacionReferencia: Vinculación con factura original ────────────
  const infoRef: any = {
    NCFModificado: encfAfectado || 'E310000000001',
    FechaNCFModificado: formatECFDateOnly(options?.fechaNCFModificado || invoice.date || now),
    CodigoModificacion: codigoMod,
    RazonModificacion: options?.razonCorreccion || (invoice as any).reason || 'Devolución de mercancía',
  };
  clean(infoRef);

  // ─── Comprador ──────────────────────────────────────────────────────────
  const rnc = invoice.clientRnc || undefined; // undefined para que clean() lo elimine si no existe
  const comprador: any = {
    RNCComprador: rnc,
    RazonSocialComprador: invoice.clientName,
  };
  clean(comprador);

  // ─── Detalle: Usar transformador específico para NC ─────────────────────
  const items = transformCreditNoteItems(invoice.items);

  return {
    ECF: {
      Encabezado: {
        Version: '1.0',
        IdDoc: idDoc,
        Emisor: buildEmisorBlock(emisor, formatECFDateOnly(invoice.date || now)),
        Comprador: Object.keys(comprador).length > 0 ? comprador : undefined,
        Totales: buildTotalesBlock(itbis, invoice.total),
      },
      DetallesItems: {
        Item: items,
      },
      InformacionReferencia: Object.keys(infoRef).length > 0 ? infoRef : undefined,
      FechaHoraFirma: formatECFDate(now),
    },
  };
}

// ─── E44: Regímenes Especiales ────────────────────────────────────────────────

export function buildE44Json(invoice: Invoice, encf: string, emisor: EcfEmissor, options?: ECFBuildOptions): object {
  const now = new Date();
  const itbis = calcITBISTotals(invoice.items, invoice.tax, 44);
  const fechaVenc = options?.fechaVencimientoSecuencia || getDefaultFechaVencimientoSecuencia();

  const idDoc: any = {
    TipoeCF: 44,
    eNCF: encf,
    FechaVencimientoSecuencia: fechaVenc,
    IndicadorEnvioDiferido: 1,
    IndicadorMontoGravado: 0,
    TipoIngresos: "01",
    TipoPago: 1,
    FechaLimitePago: formatECFDateOnly(invoice.dueDate),
    TerminoPago: invoice.paymentTerms || '30 Días',
  };
  sanitizeIdDocForTipo('E44', idDoc);
  clean(idDoc);

  const comprador: any = {
    RNCComprador: invoice.clientRnc || '',
    RazonSocialComprador: invoice.clientName,
    InformacionAdicionalComprador: invoice.taxExemptionCode ? {
      CodigoCarnetExencion: invoice.taxExemptionCode
    } : undefined,
  };
  clean(comprador);

  return {
    ECF: {
      Encabezado: {
        Version: '1.0',
        IdDoc: idDoc,
        Emisor: buildEmisorBlock(emisor, formatECFDateOnly(invoice.date || now)),
        Comprador: Object.keys(comprador).length > 0 ? comprador : undefined,
        Totales: buildTotalesBlock(itbis, invoice.total),
      },
      DetallesItems: { Item: transformItems(invoice.items, 44) },
      FechaHoraFirma: formatECFDate(now),
    },
  };
}

// ─── E45: Gubernamental ───────────────────────────────────────────────────────

export function buildE45Json(invoice: Invoice, encf: string, emisor: EcfEmissor, options?: ECFBuildOptions): object {
  const now = new Date();
  const itbis = calcITBISTotals(invoice.items, invoice.tax, 45);
  const fechaVenc = options?.fechaVencimientoSecuencia || getDefaultFechaVencimientoSecuencia();

  const idDoc: any = {
    TipoeCF: 45,
    eNCF: encf,
    FechaVencimientoSecuencia: fechaVenc,
    IndicadorEnvioDiferido: 1,
    IndicadorMontoGravado: 0,
    TipoIngresos: "01",
    TipoPago: 1,
    FechaLimitePago: formatECFDateOnly(invoice.dueDate),
    TerminoPago: invoice.paymentTerms || '30 Días',
  };
  sanitizeIdDocForTipo('E45', idDoc);
  clean(idDoc);

  const comprador: any = {
    RNCComprador: invoice.clientRnc || '',
    RazonSocialComprador: invoice.clientName,
    DireccionComprador: invoice.clientAddress || '',
    InformacionAdicionalComprador: invoice.taxExemptionCode ? {
      CodigoCarnetExencion: invoice.taxExemptionCode
    } : undefined,
  };
  clean(comprador);

  return {
    ECF: {
      Encabezado: {
        Version: '1.0',
        IdDoc: idDoc,
        Emisor: buildEmisorBlock(emisor, formatECFDateOnly(invoice.date || now)),
        Comprador: Object.keys(comprador).length > 0 ? comprador : undefined,
        Totales: buildTotalesBlock(itbis, invoice.total),
      },
      DetallesItems: { Item: transformItems(invoice.items, 45) },
      FechaHoraFirma: formatECFDate(now),
    },
  };
}

// ─── E46: Exportaciones ───────────────────────────────────────────────────────

export function buildE46Json(invoice: Invoice, encf: string, emisor: EcfEmissor, options?: ECFBuildOptions): object {
  const now = new Date();
  const fechaVenc = options?.fechaVencimientoSecuencia || getDefaultFechaVencimientoSecuencia();
  const montoTotal = Math.round(invoice.total * 100) / 100;

  const idDoc: any = {
    TipoeCF: 46,
    eNCF: encf,
    FechaVencimientoSecuencia: fechaVenc,
    IndicadorEnvioDiferido: 1,
    IndicadorMontoGravado: 0,
    TipoIngresos: "01",
    TipoPago: 1,
    FechaLimitePago: formatECFDateOnly(invoice.dueDate),
    TerminoPago: invoice.paymentTerms || '30 Días',
  };
  sanitizeIdDocForTipo('E46', idDoc);
  clean(idDoc);

  const comprador: any = {
    RNCComprador: '', // Obligatorio vacío para exportación
    IdentificadorExtranjero: invoice.clientRnc || '999999999', // ID del cliente extranjero
    RazonSocialComprador: invoice.clientName,
    DireccionComprador: invoice.clientAddress || 'N/A',
  };
  clean(comprador);

  const items = invoice.items.map((item, idx) => {
    const gross = Math.round((item.quantity * item.price) * 100) / 100;
    const discount = item.discount > 0
      ? Math.round((gross * (item.discount / 100)) * 100) / 100
      : 0;
    const net = Math.round((gross - discount) * 100) / 100;

    const res: any = {
      NumeroLinea: idx + 1,
      IndicadorFacturacion: 3, // Tasa 0% (I3), no exento
      NombreItem: item.productName.substring(0, 80),
      IndicadorBienoServicio: 1,
      CantidadItem: item.quantity,
      UnidadMedida: 1,
      PrecioUnitarioItem: f(item.price),
      MontoItem: f(net),
    };

    if (discount > 0) {
      res.DescuentoMonto = f(discount);
    }

    return res;
  });

  // E46 = Exportaciones, tasa 0%. MontoGravadoI3 = suma neta de items (sin ITBIS)
  const sumaItems = items.reduce((s: number, i: any) => s + parseFloat(i.MontoItem), 0);
  const montoGravadoI3 = Math.round(sumaItems * 100) / 100;

  const totales: any = {
    MontoGravadoTotal: f(montoGravadoI3),
    MontoGravadoI3: f(montoGravadoI3),
    ITBIS3: "0",
    TotalITBIS: f(0),
    TotalITBIS3: f(0),
    MontoTotal: f(montoGravadoI3),
  };
  clean(totales);

  return {
    ECF: {
      Encabezado: {
        Version: '1.0',
        IdDoc: idDoc,
        Emisor: buildEmisorBlock(emisor, formatECFDateOnly(invoice.date || now)),
        Comprador: Object.keys(comprador).length > 0 ? comprador : undefined,
        Totales: totales,
      },
      DetallesItems: { Item: items },
      FechaHoraFirma: formatECFDate(now),
    },
  };
}

// ─── Helper: Gastos (E41, E43, E47) ──────────────────────────────────────────

function normalizeRncCedula(value?: string): string | undefined {
  const digits = String(value || '').replace(/\D/g, '');
  if ([9, 11].includes(digits.length)) return digits;
  return undefined;
}

function inferExpensePaymentType(paymentMethod?: string): number | undefined {
  switch (paymentMethod) {
    case 'Transferencia':
    case 'Cheque':
      return 2;
    case 'Tarjeta':
      return 3;
    case 'Efectivo':
    default:
      return 1;
  }
}

function buildExpenseE41Json(expense: Expense, encf: string, emisor: EcfEmissor, options?: ECFBuildOptions): object {
  const now = new Date();
  const fechaVenc = options?.fechaVencimientoSecuencia || getDefaultFechaVencimientoSecuencia();
  const montoTotal = Math.round((expense.amount || 0) * 100) / 100;
  const montoGravado = Math.round((montoTotal / 1.18) * 100) / 100;
  const totalITBIS = Math.round((montoTotal - montoGravado) * 100) / 100;

  const idDoc: any = {
    TipoeCF: 41,
    eNCF: encf,
    FechaVencimientoSecuencia: fechaVenc,
    IndicadorMontoGravado: 0,
    TipoPago: 1, // E41 gastos: siempre Contado (TipoPago=2 requiere FechaLimitePago)
  };
  sanitizeIdDocForTipo('E41', idDoc);
  clean(idDoc);

  const comprador: any = {
    RNCComprador: normalizeRncCedula((expense as any).supplierRnc || expense.supplierName),
    RazonSocialComprador: expense.supplierName || 'PROVEEDOR NO ESPECIFICADO',
  };
  clean(comprador);

  // REGLA DGII: Cuando el nodo Retencion existe, AMBOS montos son obligatorios
  // (verificado con E410000000017 Aceptado que incluía MontoISRRetenido: 0.00)
  const retencion: any = {};
  if (totalITBIS > 0) {
    retencion.IndicadorAgenteRetencionoPercepcion = 1; // 1=Retención
    retencion.MontoITBISRetenido = f(totalITBIS);
    retencion.MontoISRRetenido = f(0);
  }
  
  const item: any = {
    NumeroLinea: 1,
    IndicadorFacturacion: 1,
    // REGLA DGII: El nodo Retencion DEBE ir antes de NombreItem en E41/E47
    ...(Object.keys(retencion).length > 0 ? { Retencion: retencion } : {}),
    NombreItem: expense.description.substring(0, 80),
    IndicadorBienoServicio: 2, // 2=Servicio
    CantidadItem: 1,
    UnidadMedida: 23, // 23=Servicios
    PrecioUnitarioItem: f(montoGravado),
    MontoItem: f(montoGravado),
  };
  clean(item);

  const totales = buildTotalesBlock({
    MontoGravadoI1: montoGravado,
    TotalITBIS1: totalITBIS,
    MontoGravadoI2: 0,
    TotalITBIS2: 0,
    MontoExento: 0,
    MontoGravadoTotal: montoGravado,
    TotalITBIS: totalITBIS,
  }, montoTotal);

  // REGLA DGII: Retenciones en Totales deben cuadrar con las del Detalle
  if (totalITBIS > 0) {
    totales.TotalITBISRetenido = f(totalITBIS);
    totales.TotalISRRetencion = f(0);
  }

  return {
    ECF: {
      Encabezado: {
        Version: '1.0',
        IdDoc: idDoc,
        Emisor: buildEmisorBlock(emisor, formatECFDateOnly(expense.date || now)),
        Comprador: Object.keys(comprador).length > 0 ? comprador : undefined,
        Totales: totales,
      },
      DetallesItems: { Item: [item] },
      FechaHoraFirma: formatECFDate(now),
    },
  };
}

function buildExpenseE43Json(expense: Expense, encf: string, emisor: EcfEmissor, options?: ECFBuildOptions): object {
  const now = new Date();
  const fechaVenc = options?.fechaVencimientoSecuencia || getDefaultFechaVencimientoSecuencia();
  const montoTotal = Math.round((expense.amount || 0) * 100) / 100;

  const idDoc: any = {
    TipoeCF: 43,
    eNCF: encf,
    FechaVencimientoSecuencia: fechaVenc,
  };
  sanitizeIdDocForTipo('E43', idDoc);
  clean(idDoc);

  const item: any = {
    NumeroLinea: 1,
    IndicadorFacturacion: 4,
    NombreItem: expense.description.substring(0, 80),
    IndicadorBienoServicio: 2,
    CantidadItem: 1,
    UnidadMedida: 23,
    PrecioUnitarioItem: f(montoTotal),
    MontoItem: f(montoTotal),
  };
  clean(item);

  const totales = buildTotalesBlock({
    MontoGravadoI1: 0,
    TotalITBIS1: 0,
    MontoGravadoI2: 0,
    TotalITBIS2: 0,
    MontoExento: montoTotal,
    MontoGravadoTotal: 0,
    TotalITBIS: 0,
  }, montoTotal);

  return {
    ECF: {
      Encabezado: {
        Version: '1.0',
        IdDoc: idDoc,
        Emisor: buildEmisorBlock(emisor, formatECFDateOnly(expense.date || now)),
        Totales: totales,
      },
      DetallesItems: { Item: [item] },
      FechaHoraFirma: formatECFDate(now),
    },
  };
}

function buildExpenseE47Json(expense: Expense, encf: string, emisor: EcfEmissor, options?: ECFBuildOptions): object {
  const now = new Date();
  const fechaVenc = options?.fechaVencimientoSecuencia || getDefaultFechaVencimientoSecuencia();
  const montoTotal = Math.round((expense.amount || 0) * 100) / 100;

  const idDoc: any = {
    TipoeCF: 47,
    eNCF: encf,
    FechaVencimientoSecuencia: fechaVenc,
    TipoPago: inferExpensePaymentType(expense.paymentMethod),
  };
  sanitizeIdDocForTipo('E47', idDoc);
  clean(idDoc);

  const comprador: any = {
    RazonSocialComprador: expense.supplierName || 'BENEFICIARIO EXTERIOR',
  };
  clean(comprador);

  // Para pagos al exterior (E47) generalmente hay retención de ISR (ej. 27%, Art. 305)
  const montoRetencionISR = Math.round((montoTotal * 0.27) * 100) / 100;
  // REGLA DGII V1.0: El tag unificado es IndicadorAgenteRetencionoPercepcion (1=Retención)
  // Para E47 (Pagos Exterior): solo MontoISRRetenido aplica. MontoITBISRetenido se OMITE.
  const retencion: any = {
    IndicadorAgenteRetencionoPercepcion: 1, // 1=Retención
    MontoISRRetenido: f(montoRetencionISR),
  };

  const item: any = {
    NumeroLinea: 1,
    IndicadorFacturacion: 4,
    // El nodo Retencion DEBE ir antes de NombreItem
    Retencion: retencion,
    NombreItem: expense.description.substring(0, 80),
    IndicadorBienoServicio: 2,
    CantidadItem: 1,
    UnidadMedida: 23,
    PrecioUnitarioItem: f(montoTotal),
    MontoItem: f(montoTotal),
  };
  clean(item);

  const totales = buildTotalesBlock({
    MontoGravadoI1: 0,
    TotalITBIS1: 0,
    MontoGravadoI2: 0,
    TotalITBIS2: 0,
    MontoExento: montoTotal,
    MontoGravadoTotal: 0,
    TotalITBIS: 0,
  }, montoTotal);

  // REGLA DGII: La suma de retenciones en detalle DEBE declararse en Totales del Encabezado
  totales.TotalISRRetencion = f(montoRetencionISR);

  return {
    ECF: {
      Encabezado: {
        Version: '1.0',
        IdDoc: idDoc,
        Emisor: buildEmisorBlock(emisor, formatECFDateOnly(expense.date || now)),
        Comprador: Object.keys(comprador).length > 0 ? comprador : undefined,
        Totales: totales,
      },
      DetallesItems: { Item: [item] },
      FechaHoraFirma: formatECFDate(now),
    },
  };
}

export function buildE41Json(expense: Expense, encf: string, emisor: EcfEmissor, options?: ECFBuildOptions) {
  return buildExpenseE41Json(expense, encf, emisor, options);
}

export function buildE43Json(expense: Expense, encf: string, emisor: EcfEmissor, options?: ECFBuildOptions) {
  return buildExpenseE43Json(expense, encf, emisor, options);
}

export function buildE47Json(expense: Expense, encf: string, emisor: EcfEmissor, options?: ECFBuildOptions) {
  return buildExpenseE47Json(expense, encf, emisor, options);
}

// ─── Factory principal ─────────────────────────────────────────────────────────

export type ECFDocType = 'E31' | 'E32' | 'E33' | 'E34' | 'E41' | 'E43' | 'E44' | 'E45' | 'E46' | 'E47';

export function buildECFJson(
  doc: Invoice | Expense,
  encf: string,
  emisor: EcfEmissor,
  options?: ECFBuildOptions
): object {
  const type = (doc.ncfType || 'E32') as ECFDocType;
  let result: object;

  // Si es Expense, usar builders de gasto
  if ('category' in doc) {
    const expense = doc as Expense;
    switch (type) {
      case 'E41': result = buildE41Json(expense, encf, emisor, options); break;
      case 'E43': result = buildE43Json(expense, encf, emisor, options); break;
      case 'E47': result = buildE47Json(expense, encf, emisor, options); break;
      default: result = buildE43Json(expense, encf, emisor, options); break;
    }
  } else {
    // Si es Invoice
    const invoice = doc as Invoice;
    switch (type) {
      case 'E31': result = buildE31Json(invoice, encf, emisor, options); break;
      case 'E32': result = buildE32Json(invoice, encf, emisor, options); break;
      case 'E33': result = buildE33Json(invoice, encf, options?.encfAfectado || '', emisor, options); break;
      case 'E34': result = buildE34Json(invoice, encf, options?.encfAfectado || '', emisor, options); break;
      case 'E44': result = buildE44Json(invoice, encf, emisor, options); break;
      case 'E45': result = buildE45Json(invoice, encf, emisor, options); break;
      case 'E46': result = buildE46Json(invoice, encf, emisor, options); break;
      default: result = buildE32Json(invoice, encf, emisor, options); break;
    }
  }

  const idDoc = (result as any)?.ECF?.Encabezado?.IdDoc;
  sanitizeIdDocForTipo(type, idDoc);
  return result;
}

/**
 * Determina el tag XML raíz según el tipo de e-NCF.
 * Necesario para firmar con Signature.signXml(xml, rootTag)
 * Según la documentación dgii-ecf: ECF | ARECF | ACECF | ANECF | RFCE
 */
export function getECFRootTag(ncfType: string): string {
  return 'ECF';
}

/**
 * Genera el nombre del archivo e-CF según convención DGII:
 * RNCEmisor + eNCF + .xml
 * Ejemplo: 130862346E310000000001.xml
 */
export function buildECFFileName(rncEmisor: string, encf: string): string {
  return `${rncEmisor}${encf}.xml`;
}
