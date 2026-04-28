import { NCF_TYPES, Invoice, Expense, CreditNote } from '@/types';
import { format } from 'date-fns';

/**
 * Obtiene el nombre textual del tipo de e-CF (Valor P de la DGII)
 */
export function getECFTypeName(type: string): string {
  return NCF_TYPES[type] || 'Comprobante Electrónico';
}

/**
 * Genera la URL de verificación de la DGII para el QR Code
 */
export function generateVerificationUrl(
  rncEmisor: string,
  encf: string,
  montoTotal: number | string,
  fechaEmision: Date | string,
  codigoSeguridad?: string,
  rncComprador?: string,
  fechaFirma?: string,
  signedXml?: string
): string {
  // 1. Sanitizar RNCs (Sin guiones, solo números)
  const safeEmisor = String(rncEmisor || '132327179').replace(/[^0-9]/g, '');
  const safeComprador = String(rncComprador || '130701601').replace(/[^0-9]/g, '');
  
  // 2. Sanitizar ENCF
  const safeENCF = String(encf || '').trim();
  
  // 3. Sanitizar Monto (2 decimales exactos)
  const rawAmount = String(montoTotal || 0).replace(/[^0-9.-]+/g, "");
  const totalVal = parseFloat(rawAmount || "0");
  const totalStr = isNaN(totalVal) ? "0.00" : totalVal.toFixed(2);
  
  // 4. Formatear Fecha Emisión (dd-MM-yyyy)
  // IMPORTANTE: Evitar cambios de zona horaria (UTC vs Local)
  let fEmision = '';
  if (typeof fechaEmision === 'string' && /^\d{2}-\d{2}-\d{4}/.test(fechaEmision)) {
      fEmision = fechaEmision.substring(0, 10);
  } else if (typeof fechaEmision === 'string' && /^\d{4}-\d{2}-\d{2}/.test(fechaEmision)) {
      // Convertir yyyy-mm-dd a dd-mm-yyyy
      const parts = fechaEmision.substring(0, 10).split('-');
      fEmision = `${parts[2]}-${parts[1]}-${parts[0]}`;
  } else {
      try {
        const d = new Date(fechaEmision);
        fEmision = isNaN(d.getTime()) ? format(new Date(), 'dd-MM-yyyy') : format(d, 'dd-MM-yyyy');
      } catch(e) {
        fEmision = format(new Date(), 'dd-MM-yyyy');
      }
  }

  // 5. Extraer Código Seguridad (6 primeros chars del SignatureValue)
  let safeCodigo = (codigoSeguridad || '').trim();
  if ((!safeCodigo || safeCodigo === '000000') && signedXml) {
    const match = signedXml.match(/<SignatureValue[^>]*>([^<]+)<\/SignatureValue>/);
    if (match && match[1]) {
      safeCodigo = match[1].trim().substring(0, 6);
    }
  }
  if (!safeCodigo) safeCodigo = '000000';
  else safeCodigo = safeCodigo.substring(0, 6);

  // 6. Formatear Fecha Firma (dd-MM-yyyy HH:mm:ss)
  let fFirma = fechaFirma || (fEmision + ' 10:00:00');
  try {
    // Si viene en formato ISO (con T), formatear a dd-MM-yyyy HH:mm:ss
    if (fFirma.includes('T')) {
      const dF = new Date(fFirma);
      if (!isNaN(dF.getTime())) {
        fFirma = format(dF, 'dd-MM-yyyy HH:mm:ss');
      }
    }
  } catch(e) {}
  
  // Codificar espacio como %20 manualmente para asegurar compatibilidad
  const encodedFirma = fFirma.replace(' ', '%20');

  // 7. Determinar Subdominio
  const isType32 = safeENCF.startsWith('E32');
  const isSimplified = isType32 && Number(totalStr) < 250000;

  let finalUrl = '';
  if (isSimplified) {
    finalUrl = `https://fc.dgii.gov.do/eCF/ConsultaTimbreFC?RncEmisor=${safeEmisor}&ENCF=${safeENCF}&MontoTotal=${totalStr}&CodigoSeguridad=${safeCodigo}`;
  } else {
    finalUrl = `https://ecf.dgii.gov.do/ecf/ConsultaTimbre?RncEmisor=${safeEmisor}&RncComprador=${safeComprador}&ENCF=${safeENCF}&FechaEmision=${fEmision}&MontoTotal=${totalStr}&FechaFirma=${encodedFirma}&CodigoSeguridad=${safeCodigo}`;
  }

  return finalUrl;
}

/**
 * Determina si un comprobante es electrónico (e-CF)
 */
export function isECF(ncf?: string): boolean {
  if (!ncf) return false;
  return ncf.startsWith('E');
}

/**
 * Formatea el RNC/Cédula con guiones si es posible
 */
export function formatRNC(rnc?: string): string {
  if (!rnc) return '';
  const clean = rnc.replace(/[^0-9]/g, '');
  if (clean.length === 9) {
    return `${clean.substring(0, 1)}-${clean.substring(1, 8)}-${clean.substring(8)}`;
  }
  if (clean.length === 11) {
    return `${clean.substring(0, 3)}-${clean.substring(3, 10)}-${clean.substring(10)}`;
  }
  return rnc;
}
