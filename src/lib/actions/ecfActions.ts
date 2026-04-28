"use server";

import dbConnect from '@/lib/db';
import { Invoice as InvoiceModel, Expense as ExpenseModel, EcfAuditLog, CreditNote as CreditNoteModel, DebitNote as DebitNoteModel } from '@/models';
import { revalidatePath } from 'next/cache';
import {
  getECFConfig,
  authenticateWithDGII,
  signXML,
  sendElectronicDocument,
  sendSummaryDocument,
  getECFStatusByTrackId,
  ECFConfig,
} from '@/lib/ecf/ecfService';
import {
  buildECFJson,
  buildECFFileName,
  getECFRootTag,
  ECFBuildOptions,
  EcfEmissor,
} from '@/lib/ecf/ecfTransformer';
import { getInvoiceById } from '@/lib/actions/invoiceActions';
import { getNextENCF } from '@/lib/actions/settingsActions';
import { getAuthErrorMessage, requireRole, requireSession } from '@/lib/auth/session';

// ─── Auditing Helper ────────────────────────────────────────────────────────
export async function logEcfEvent({
  documentId,
  documentType,
  action,
  status,
  trackId,
  encf,
  message,
  requestPayload,
  responsePayload
}: {
  documentId?: string;
  documentType?: 'Invoice' | 'CreditNote' | 'DebitNote' | 'Expense' | 'Other';
  action: string;
  status: 'SUCCESS' | 'ERROR';
  trackId?: string;
  encf?: string;
  message?: string;
  requestPayload?: any;
  responsePayload?: any;
}) {
  try {
    const reqStr = requestPayload ? (typeof requestPayload === 'string' ? requestPayload : JSON.stringify(requestPayload)) : undefined;
    const resStr = responsePayload ? (typeof responsePayload === 'string' ? responsePayload : JSON.stringify(responsePayload)) : undefined;

    // Truncate XML payloads to avoid massive DB bloat (store only first 1500 chars if it's pure XML)
    // Actually, storing full XML could be useful for debugging, but we'll trim it to 5000 chars just in case.
    const trim = (str?: string) => str && str.length > 5000 ? str.substring(0, 5000) + '...[TRUNCATED]' : str;

    await EcfAuditLog.create({
      documentId,
      documentType,
      action,
      status,
      trackId,
      encf,
      message,
      requestPayload: trim(reqStr),
      responsePayload: trim(resStr)
    });
  } catch (error) {
    console.error("[ECF Audit Error] Failed to write audit log:", error);
  }
}

export async function getEcfAuditLogs(documentId: string) {
  try {
    await requireSession();
  } catch (error) {
    return { success: false, message: getAuthErrorMessage(error), logs: [] };
  }
  await dbConnect();
  try {
    const logs = await EcfAuditLog.find({ documentId }).sort({ createdAt: -1 }).lean();
    return {
      success: true,
      logs: logs.map((log: any) => ({
        id: log._id.toString(),
        documentType: log.documentType,
        action: log.action,
        status: log.status,
        trackId: log.trackId,
        encf: log.encf,
        message: log.message,
        requestPayload: log.requestPayload,
        responsePayload: log.responsePayload,
        createdAt: log.createdAt.toISOString(),
      }))
    };
  } catch (error: any) {
    console.error("[ECF Audit Error] Failed to fetch audit logs:", error);
    return { success: false, message: error.message, logs: [] };
  }
}

export async function getEcfSequenceExpirationDate(): Promise<string> {
  const configured =
    process.env.ECF_FECHA_VENCIMIENTO_SECUENCIA?.trim() ||
    process.env.NEXT_PUBLIC_ECF_FECHA_VENCIMIENTO_SECUENCIA?.trim();

  if (configured) {
    return configured;
  }

  return `31-12-${new Date().getFullYear() + 2}`;
}

export async function getGlobalEcfAuditLogs(
  page: number = 1,
  limit: number = 50,
  statusFilter: string = 'Todos',
  searchTerm: string = ''
) {
  try {
    await requireRole(['Administrador']);
  } catch (error) {
    return { success: false, message: getAuthErrorMessage(error), logs: [], total: 0, totalPages: 0 };
  }
  await dbConnect();
  try {
    const query: any = {};
    if (statusFilter !== 'Todos') {
      query.status = statusFilter;
    }
    if (searchTerm) {
      query.$or = [
        { trackId: { $regex: searchTerm, $options: 'i' } },
        { encf: { $regex: searchTerm, $options: 'i' } },
        { message: { $regex: searchTerm, $options: 'i' } },
      ];
    }

    const total = await EcfAuditLog.countDocuments(query);
    const totalPages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;

    const logs = await EcfAuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return {
      success: true,
      total,
      totalPages,
      logs: logs.map((log: any) => ({
        id: log._id.toString(),
        documentId: log.documentId,
        documentType: log.documentType,
        action: log.action,
        status: log.status,
        trackId: log.trackId,
        encf: log.encf,
        message: log.message,
        requestPayload: log.requestPayload,
        responsePayload: log.responsePayload,
        createdAt: log.createdAt.toISOString(),
      })),
    };
  } catch (error: any) {
    console.error("[ECF Audit Error] Failed to fetch global audit logs:", error);
    return { success: false, message: error.message, logs: [], total: 0, totalPages: 0 };
  }
}

// ─── Constants ─────────────────────────────────────────────────────────────────

/** DOP $250,000 threshold for RFCE summary submission (E32 only) */
const RFCE_THRESHOLD = 250000;

// ─── Re-exportar config (para uso en UI) ──────────────────────────────────────

export async function getECFConfiguration(): Promise<ECFConfig> {
  await requireSession();
  return getECFConfig();
}

// ─── Probar conexión con DGII ──────────────────────────────────────────────────

export async function testDGIIConnection(): Promise<{ success: boolean; message: string }> {
  try {
    await requireRole(['Administrador']);
  } catch (error) {
    return { success: false, message: getAuthErrorMessage(error) };
  }
  return authenticateWithDGII();
}

// ─── Helper: Obtener documento de cualquier colección ──────────────────────────

async function getDocumentGeneral(id: string) {
  await dbConnect();
  // Intentar en facturas
  const doc = await InvoiceModel.findById(id).lean();
  if (doc) return { data: doc, model: InvoiceModel, type: 'Invoice' as const };

  // Intentar en notas de crédito
  const creditDoc = await CreditNoteModel.findById(id).lean();
  if (creditDoc) return { data: creditDoc, model: CreditNoteModel, type: 'CreditNote' as const };

  // Intentar en notas de débito
  const debitDoc = await DebitNoteModel.findById(id).lean();
  if (debitDoc) return { data: debitDoc, model: DebitNoteModel, type: 'DebitNote' as const };

  return null;
}

// ─── Helper: Extraer código de seguridad del XML firmado ───────────────────────

function extractSecurityCode(signedXml: string): string | undefined {
  try {
    // Dynamic import of the utility function from dgii-ecf
    const { getCodeSixDigitfromSignature } = require('dgii-ecf');
    return getCodeSixDigitfromSignature(signedXml) || undefined;
  } catch {
    // Fallback: manual extraction from SignatureValue
    try {
      const match = signedXml.match(/<SignatureValue[^>]*>([^<]+)<\/SignatureValue>/);
      if (match?.[1]) {
        const crypto = require('crypto');
        const hash = crypto.createHash('sha256').update(match[1]).digest('hex');
        return hash.substring(0, 6).toUpperCase();
      }
    } catch { }
    return undefined;
  }
}

// ─── Helper: Formatear fecha de firma ──────────────────────────────────────────

function formatFechaFirma(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

// ─── Enviar e-CF a la DGII ────────────────────────────────────────────────────

export async function sendECF(
  invoiceId: string,
  options?: {
    encfAfectado?: string;
    codigoModificacion?: 1 | 2 | 3 | 4;
    razonCorreccion?: string;
  }
): Promise<{
  success: boolean;
  message?: string;
  trackId?: string;
  encf?: string;
  isRFCE?: boolean;
}> {
  try {
    await requireRole(['Administrador', 'Ventas']);
  } catch (error) {
    return { success: false, message: getAuthErrorMessage(error) };
  }
  await dbConnect();

  // 1. Obtener el documento (Factura, NC o ND)
  const docResult = await getDocumentGeneral(invoiceId);
  if (!docResult) {
    return { success: false, message: 'Documento no encontrado (Factura/NC/ND).' };
  }
  const invoice = docResult.data as any;
  const Model: any = docResult.model;
  const documentType = docResult.type as 'Invoice' | 'CreditNote' | 'DebitNote' | 'Expense' | 'Other'; // for audit

  // 2. Verificar que sea un tipo e-NCF
  const ncfType = invoice.ncfType || '';
  if (!ncfType.startsWith('E')) {
    return {
      success: false,
      message: `El tipo "${ncfType}" no es un tipo e-NCF. Solo los tipos E31, E32, E43, etc. pueden enviarse electrónicamente.`,
    };
  }

  // 3. Verificar config del certificado
  const config = getECFConfig();
  if (!config.isConfigured) {
    return {
      success: false,
      message: 'El certificado digital no está configurado. Agrega ECF_CERTIFICATE_BASE64, ECF_CERTIFICATE_PASSPHRASE y ECF_RNC_EMISOR en tu .env.local.',
    };
  }

  try {
    // 4. Generar e-NCF si todavía no tiene uno
    let encf = invoice.encf || (typeof invoice.ncf === 'string' && invoice.ncf.startsWith('E') ? invoice.ncf : undefined);
    if (!encf) {
      encf = await getNextENCF(ncfType);
      // Guardar provisionalmente para evitar duplicados
      await Model.findByIdAndUpdate(invoiceId, { encf, ecfStatus: 'Pendiente' });
    }

    // 5. Construir el JSON del e-CF
    const emisor: EcfEmissor = {
      RNCEmisor: config.rncEmisor,
      RazonSocialEmisor: config.razonSocial,
      NombreComercial: config.razonSocial,
      DireccionEmisor: config.direccionEmisor,
        Municipio: config.municipioEmisor,
      Provincia: config.provinciaEmisor,
      TelefonoEmisor: config.telefonoEmisor,
      CorreoEmisor: config.correoEmisor,
    };

    // 5.1 Auto-populate build options for Credit/Debit Notes
    let autoEncfAfectado = options?.encfAfectado;
    let autoFechaNCFModificado = (options as any)?.fechaNCFModificado;
    let autoCodigoModificacion = options?.codigoModificacion;

    if (['E33', 'E34'].includes(ncfType)) {
        // Fetch original invoice to get its NCF and date
        if (!invoice.originalInvoiceId) {
            throw new Error(`La nota ${ncfType} no tiene referencia a la factura original (originalInvoiceId).`);
        }
        const originalInvoice = await InvoiceModel.findById(invoice.originalInvoiceId).lean() as any;
        if (!originalInvoice) {
            throw new Error(`La factura original (ID: ${invoice.originalInvoiceId}) no fue encontrada. No se puede generar la nota ${ncfType}.`);
        }
        autoEncfAfectado = autoEncfAfectado || originalInvoice.encf || originalInvoice.ncf;
        autoFechaNCFModificado = autoFechaNCFModificado || originalInvoice.date;
        autoCodigoModificacion = autoCodigoModificacion || invoice.codigoModificacion || (ncfType === 'E34' ? 1 : 3);
        
        if (!autoEncfAfectado) {
            throw new Error(`La factura original (${originalInvoice.number}) no tiene e-NCF asignado. Envíela primero a la DGII.`);
        }
        console.log(`[ECF] ${ncfType}: NCFModificado=${autoEncfAfectado}, CodigoMod=${autoCodigoModificacion}`);
    }

    const buildOptions: ECFBuildOptions = {
      encfAfectado: autoEncfAfectado,
      codigoModificacion: autoCodigoModificacion as any,
      razonCorreccion: options?.razonCorreccion || (invoice as any).reason,
      fechaVencimientoSecuencia: config.fechaVencimientoSecuencia,
      fechaNCFModificado: autoFechaNCFModificado,
    };

    console.log(`[ECF] Construyendo JSON para ${ncfType}...`);
    const ecfJson = buildECFJson(invoice, encf!, emisor, buildOptions);

    // 6. Transformar JSON → XML usando dgii-ecf Transformer
    console.log(`[ECF] Transformando JSON → XML...`);
    const { Transformer } = await import('dgii-ecf');
    const transformer = new Transformer();
    const xml = transformer.json2xml(ecfJson);

    if (!xml) {
      throw new Error('Error generando XML del e-CF. El transformador devolvió null.');
    }

    // 7. Firmar el XML
    const rootTag = getECFRootTag(ncfType);
    const signedXml = await signXML(xml, rootTag);
    const fechaFirma = formatFechaFirma();

    // 8. Extraer código de seguridad del XML firmado
    const codigoSeguridad = extractSecurityCode(signedXml);

    // 9. Determinar si es RFCE (E32 < $250K DOP) o envío directo
    const isRFCE = ncfType === 'E32' && invoice.total < RFCE_THRESHOLD;
    let result;

    if (isRFCE) {
      // ── RFCE: Convertir ECF32 → RFCE summary y enviar
      const { convertECF32ToRFCE } = await import('dgii-ecf');
      const { xml: rfceXml, securityCode: rfceCode } = convertECF32ToRFCE(signedXml);

      // Firmar el RFCE
      const signedRFCE = await signXML(rfceXml, 'RFCE');
      const fileName = buildECFFileName(config.rncEmisor, encf!);

      result = await sendSummaryDocument(signedRFCE, fileName);

      console.log(`[ECF] E32 < $250K → Enviado como RFCE. Código seguridad: ${rfceCode || codigoSeguridad}`);
    } else {
      // ── Envío directo a DGII
      const fileName = buildECFFileName(config.rncEmisor, encf!);
      result = await sendElectronicDocument(signedXml, fileName);
    }

    // 10. Almacenar XML firmado + metadata en DB para auditoría y Representación Impresa
    // RFCE: Si el resumen fue aceptado, el status es 'Aceptado' directamente (no hay polling)
    const ecfStatusValue = isRFCE && result.success ? 'Aceptado' 
      : result.success ? 'Pendiente' 
      : 'Rechazado';
    await Model.findByIdAndUpdate(invoiceId, {
      encf,
      ecfStatus: ecfStatusValue,
      ecfTrackId: result.trackId,
      ecfSignedXml: signedXml,
      ecfFechaFirma: fechaFirma,
      ecfCodigoSeguridad: codigoSeguridad,
    });

    if (!result.success) {
      const sendMsg = result.message || JSON.stringify(result.rawResponse) || 'Error desconocido del servicio DGII';
      await logEcfEvent({
        documentId: invoiceId,
        documentType: documentType as any,
        action: 'SEND_ECF',
        status: 'ERROR',
        encf,
        message: sendMsg,
        requestPayload: ecfJson,
        responsePayload: result.rawResponse
      });
      return { success: false, message: sendMsg };
    }

    revalidatePath('/invoices');
    revalidatePath(`/invoices/${invoiceId}`);

    await logEcfEvent({
      documentId: invoiceId,
      documentType: documentType as any,
      action: 'SEND_ECF',
      status: 'SUCCESS',
      trackId: result.trackId,
      encf,
      message: isRFCE ? 'RFCE enviado a DGII' : 'e-CF enviado a DGII',
      requestPayload: ecfJson,
      responsePayload: result.rawResponse
    });

    return {
      success: true,
      trackId: result.trackId,
      encf,
      isRFCE,
      message: isRFCE
        ? `RFCE enviado correctamente (E32 < $250K). TrackId: ${result.trackId}`
        : `e-CF enviado correctamente. TrackId: ${result.trackId}`,
    };
  } catch (err: any) {
    const errorMsg = err?.message || 'Error desconocido al enviar el e-CF.';
    const errorStack = err?.stack || '';
    console.error('[ECF] Error enviando e-CF:', errorMsg, '\nStack:', errorStack);
    
    // Log the error to audit trail for debugging
    try {
      await logEcfEvent({
        documentId: invoiceId,
        documentType: documentType as any,
        action: 'SEND_ECF',
        status: 'ERROR',
        encf: invoice.encf,
        message: `Error interno: ${errorMsg}`,
        requestPayload: errorStack,
      });
    } catch { /* ignore audit errors */ }
    
    return { success: false, message: errorMsg };
  }
}

// ─── Consultar estado del e-CF en la DGII ─────────────────────────────────────

export async function checkECFStatus(invoiceId: string): Promise<{
  success: boolean;
  estado?: string;
  message?: string;
  trackId?: string;
}> {
  try {
    await requireRole(['Administrador', 'Ventas']);
  } catch (error) {
    return { success: false, message: getAuthErrorMessage(error) };
  }
  await dbConnect();

  // 1. Obtener el documento
  const docResult = await getDocumentGeneral(invoiceId);
  if (!docResult) {
    return { success: false, message: 'Documento no encontrado.' };
  }
  const doc = docResult.data as any;
  const Model: any = docResult.model;
  const documentType = docResult.type as any;

  if (!doc.ecfTrackId) {
    return { success: false, message: 'Esta factura no tiene un TrackId de e-CF. Envíala primero.' };
  }

  const config = getECFConfig();
  if (!config.isConfigured) {
    return { success: false, message: 'Certificado no configurado.' };
  }

  try {
    const result = await getECFStatusByTrackId(doc.ecfTrackId);

    if (!result.success) {
      await logEcfEvent({
        documentId: invoiceId,
        documentType: documentType,
        action: 'CHECK_STATUS',
        status: 'ERROR',
        trackId: doc.ecfTrackId,
        encf: doc.encf,
        message: result.message
      });
      return { success: false, message: result.message };
    }

    // Mapear código de estado de DGII a nuestro enum
    const estadoMap: Record<string, string> = {
      '1': 'Aceptado',
      '2': 'Rechazado',
      '3': 'AceptadoCondicional',
      '4': 'Contingencia',
    };
    const ecfStatus = estadoMap[result.codigo || ''] || 'Pendiente';

    // Actualizar en DB
    await Model.findByIdAndUpdate(invoiceId, { ecfStatus });

    revalidatePath('/invoices');
    revalidatePath(`/invoices/${invoiceId}`);

    const detailMessage = result.mensajes && result.mensajes.length > 0
      ? `Estado DGII: ${result.estado} — ${result.mensajes.map((m: any) => m.valor).join(' | ')}`
      : `Estado DGII: ${result.estado || 'Sin información'}`;

    await logEcfEvent({
      documentId: invoiceId,
      documentType: documentType,
      action: 'CHECK_STATUS',
      status: 'SUCCESS',
      trackId: result.trackId,
      encf: doc.encf,
      message: detailMessage,
      responsePayload: result
    });

    return {
      success: true,
      estado: result.estado,
      trackId: result.trackId,
      message: `Estado DGII: ${result.estado || 'Sin información'}`,
    };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

// ─── Enviar e-CF al Receptor (Sender→Receiver) ───────────────────────────────

/**
 * Busca la URL de recepción del comprador en el directorio DGII
 * y envía el e-CF firmado directamente al sistema del comprador.
 * Solo aplica para E31 (Crédito Fiscal) donde el comprador es otro emisor electrónico.
 */
export async function sendECFToReceiver(invoiceId: string): Promise<{
  success: boolean;
  message?: string;
}> {
  try {
    await requireRole(['Administrador', 'Ventas']);
  } catch (error) {
    return { success: false, message: getAuthErrorMessage(error) };
  }
  await dbConnect();

  const docResult = await getDocumentGeneral(invoiceId);
  if (!docResult) {
    return { success: false, message: 'Documento no encontrado.' };
  }
  const doc = docResult.data as any;

  if (!doc.encf) {
    return { success: false, message: 'La factura no tiene e-NCF. Envíe primero a la DGII.' };
  }

  if (!doc.ecfSignedXml) {
    return { success: false, message: 'No hay XML firmado almacenado. Reenvíe el e-CF a la DGII primero.' };
  }

  if (!doc.clientRnc) {
    return { success: false, message: 'El cliente no tiene RNC/Cédula registrada.' };
  }

  const config = getECFConfig();
  if (!config.isConfigured) {
    return { success: false, message: 'Certificado no configurado.' };
  }

  try {
    const { default: ECF, P12Reader, ENVIRONMENT } = await import('dgii-ecf');

    // 1. Buscar la URL de recepción del comprador en el directorio DGII
    const certBase64 = process.env.ECF_CERTIFICATE_BASE64!;
    const passphrase = process.env.ECF_CERTIFICATE_PASSPHRASE!;
    const environment = process.env.ECF_ENVIRONMENT || 'TesteCF';

    const envMap: Record<string, any> = {
      'TesteCF': ENVIRONMENT.DEV,
      'CerteCF': ENVIRONMENT.CERT,
      'eCF': ENVIRONMENT.PROD,
    };

    const reader = new P12Reader(passphrase);
    const certs = reader.getKeyFromStringBase64(certBase64);
    const ecf = new ECF(certs, envMap[environment] ?? ENVIRONMENT.DEV);

    // Look up buyer directory
    const directory = await ecf.getCustomerDirectory(doc.clientRnc);

    if (!directory || directory.length === 0) {
      return {
        success: false,
        message: `No se encontró al RNC ${doc.clientRnc} en el directorio de emisores electrónicos de la DGII. El comprador puede no ser un emisor electrónico.`,
      };
    }

    const buyerUrl = directory[0].urlRecepcion;
    if (!buyerUrl) {
      return {
        success: false,
        message: `El comprador ${directory[0].nombre} no tiene URL de recepción registrada en la DGII.`,
      };
    }

    // 2. Authenticate with the buyer's host
    await ecf.authenticate(buyerUrl);

    // 3. Send the signed XML to the buyer
    const fileName = buildECFFileName(config.rncEmisor, doc.encf);
    const response = await ecf.sendElectronicDocument(doc.ecfSignedXml, fileName, buyerUrl);

    revalidatePath('/invoices');

    return {
      success: true,
      message: `e-CF enviado al receptor (${directory[0].nombre}). ${response?.trackId ? `TrackId receptor: ${response.trackId}` : ''}`,
    };
  } catch (err: any) {
    console.error('[ECF] Error enviando al receptor:', err);
    return { success: false, message: `Error enviando al receptor: ${err.message}` };
  }
}

// ─── Consultar directorio del comprador ───────────────────────────────────────

export async function lookupBuyerDirectory(rnc: string): Promise<{
  success: boolean;
  data?: {
    nombre: string;
    rnc: string;
    urlRecepcion: string;
    urlAceptacion: string;
  };
  message?: string;
}> {
  try {
    await requireRole(['Administrador']);
  } catch (error) {
    return { success: false, message: getAuthErrorMessage(error) };
  }
  const config = getECFConfig();
  if (!config.isConfigured) {
    return { success: false, message: 'Certificado no configurado.' };
  }

  try {
    const { default: ECF, P12Reader, ENVIRONMENT } = await import('dgii-ecf');

    const certBase64 = process.env.ECF_CERTIFICATE_BASE64!;
    const passphrase = process.env.ECF_CERTIFICATE_PASSPHRASE!;
    const environment = process.env.ECF_ENVIRONMENT || 'TesteCF';

    const envMap: Record<string, any> = {
      'TesteCF': ENVIRONMENT.DEV,
      'CerteCF': ENVIRONMENT.CERT,
      'eCF': ENVIRONMENT.PROD,
    };

    const reader = new P12Reader(passphrase);
    const certs = reader.getKeyFromStringBase64(certBase64);
    const ecf = new ECF(certs, envMap[environment] ?? ENVIRONMENT.DEV);

    await ecf.authenticate();
    const directory = await ecf.getCustomerDirectory(rnc);

    if (!directory || directory.length === 0) {
      return {
        success: false,
        message: `No se encontró al RNC ${rnc} en el directorio de emisores electrónicos.`,
      };
    }

    return {
      success: true,
      data: {
        nombre: directory[0].nombre,
        rnc: directory[0].rnc,
        urlRecepcion: directory[0].urlRecepcion,
        urlAceptacion: directory[0].urlAceptacion,
      },
    };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

export async function queryECFDocument(
  rncEmisor: string,
  rncComprador: string,
  encf: string
): Promise<{
  success: boolean;
  data?: any;
  message?: string;
}> {
  try {
    await requireRole(['Administrador']);
  } catch (error) {
    return { success: false, message: getAuthErrorMessage(error) };
  }
  const config = getECFConfig();
  if (!config.isConfigured) {
    return { success: false, message: 'Certificado no configurado.' };
  }

  try {
    const { default: ECF, P12Reader, ENVIRONMENT } = await import('dgii-ecf');

    const certBase64 = process.env.ECF_CERTIFICATE_BASE64!;
    const passphrase = process.env.ECF_CERTIFICATE_PASSPHRASE!;
    const environment = process.env.ECF_ENVIRONMENT || 'TesteCF';

    const envMap: Record<string, any> = {
      'TesteCF': ENVIRONMENT.DEV,
      'CerteCF': ENVIRONMENT.CERT,
      'eCF': ENVIRONMENT.PROD,
    };

    const reader = new P12Reader(passphrase);
    const certs = reader.getKeyFromStringBase64(certBase64);
    const ecf = new ECF(certs, envMap[environment] ?? ENVIRONMENT.DEV);

    await ecf.authenticate();

    // Call inquiryStatus on the ecf instance
    const response = await ecf.inquiryStatus(rncEmisor, encf, rncComprador);

    return {
      success: true,
      data: response,
      message: 'Consulta realizada con éxito.',
    };
  } catch (err: any) {
    console.error('[ECF] Error consultando documento:', err);
    return { success: false, message: err.message };
  }
}

// ─── Gastos (E41, E43, E47) ────────────────────────────────────────────────────

export async function sendExpenseECF(expenseId: string): Promise<{
  success: boolean;
  message?: string;
  trackId?: string;
  encf?: string;
}> {
  try {
    await requireRole(['Administrador']);
  } catch (error) {
    return { success: false, message: getAuthErrorMessage(error) };
  }
  await dbConnect();

  const expense = await ExpenseModel.findById(expenseId).lean() as any;
  if (!expense) return { success: false, message: 'Gasto no encontrado.' };

  const ncfType = expense.ncfType || '';
  if (!['E41', 'E43', 'E47'].includes(ncfType)) {
    return { success: false, message: `El tipo ${ncfType} no es un comprobante de gasto válido para enviar a DGII.` };
  }

  const { isContingencyActive } = await import('./ecfContingencyActions');
  const contingencyActive = await isContingencyActive();

  if (contingencyActive) {
    return { success: false, message: 'No se pueden enviar comprobantes electrónicos de gastos durante contingencia.' };
  }

  const config = getECFConfig();
  if (!config.isConfigured) {
    return { success: false, message: 'El certificado digital no está configurado.' };
  }

  let encf: string | undefined = expense.encf || (typeof expense.ncf === 'string' && expense.ncf.startsWith('E') ? expense.ncf : undefined);
  let ecfJson: any;

  try {
    if (!encf) {
      encf = await getNextENCF(ncfType);
      await ExpenseModel.findByIdAndUpdate(expenseId, { encf, ecfStatus: 'Pendiente' });
    }

    const supplierRnc = String(expense.supplierRnc || expense.supplierName || '').replace(/\D/g, '');
    if (ncfType === 'E41' && ![9, 11].includes(supplierRnc.length)) {
      const message = 'El gasto E41 requiere RNC o cédula válida del proveedor/beneficiario.';
      await logEcfEvent({
        documentId: expenseId,
        documentType: 'Expense',
        action: 'SEND_ECF',
        status: 'ERROR',
        encf,
        message,
      });
      return { success: false, message };
    }

    const emisor: EcfEmissor = {
      RNCEmisor: config.rncEmisor,
      RazonSocialEmisor: config.razonSocial,
      NombreComercial: config.razonSocial,
      DireccionEmisor: config.direccionEmisor,
      Municipio: config.municipioEmisor,
      Provincia: config.provinciaEmisor,
      TelefonoEmisor: config.telefonoEmisor,
      CorreoEmisor: config.correoEmisor,
    };

    ecfJson = buildECFJson(expense, encf!, emisor);

    const { Transformer } = await import('dgii-ecf');
    const transformer = new Transformer();
    const xml = transformer.json2xml(ecfJson);

    if (!xml) throw new Error('Error generando XML del e-CF.');

    const signedXml = await signXML(xml, getECFRootTag(ncfType));
    const fechaFirma = formatFechaFirma();
    const codigoSeguridad = extractSecurityCode(signedXml);

    const fileName = buildECFFileName(config.rncEmisor, encf!);
    const result = await sendElectronicDocument(signedXml, fileName);

    if (!result.success) {
      await ExpenseModel.findByIdAndUpdate(expenseId, { ecfStatus: 'Rechazado' });
      await logEcfEvent({
        documentId: expenseId,
        documentType: 'Expense',
        action: 'SEND_ECF',
        status: 'ERROR',
        encf,
        message: result.message,
        responsePayload: result.rawResponse
      });
      return { success: false, message: result.message };
    }

    await ExpenseModel.findByIdAndUpdate(expenseId, {
      encf,
      ecfStatus: 'Pendiente',
      ecfTrackId: result.trackId,
      ecfSignedXml: signedXml,
      ecfFechaFirma: fechaFirma,
      ecfCodigoSeguridad: codigoSeguridad,
    });

    revalidatePath('/expenses');

    await logEcfEvent({
      documentId: expenseId,
      documentType: 'Expense',
      action: 'SEND_ECF',
      status: 'SUCCESS',
      trackId: result.trackId,
      encf,
      message: 'e-CF de gasto enviado a DGII',
      requestPayload: ecfJson,
      responsePayload: result.rawResponse
    });

    return {
      success: true,
      trackId: result.trackId,
      encf,
      message: `e-CF enviado correctamente. TrackId: ${result.trackId}`,
    };
  } catch (err: any) {
    console.error('[ECF] Error enviando Expense e-CF:', err);
    await logEcfEvent({
      documentId: expenseId,
      documentType: 'Expense',
      action: 'SEND_ECF',
      status: 'ERROR',
      encf,
      message: err.message || 'Error desconocido enviando gasto electrónico.',
      requestPayload: ecfJson,
      responsePayload: err?.stack || err?.message,
    });
    return { success: false, message: err.message || 'Error desconocido.' };
  }
}

export async function checkExpenseECFStatus(expenseId: string): Promise<{
  success: boolean;
  estado?: string;
  message?: string;
  trackId?: string;
}> {
  try {
    await requireRole(['Administrador']);
  } catch (error) {
    return { success: false, message: getAuthErrorMessage(error) };
  }
  await dbConnect();

  const doc = await ExpenseModel.findById(expenseId).lean() as any;
  if (!doc) return { success: false, message: 'Gasto no encontrado.' };
  if (!doc.ecfTrackId) return { success: false, message: 'No tiene TrackId de e-CF.' };

  const config = getECFConfig();
  if (!config.isConfigured) return { success: false, message: 'Certificado no configurado.' };

  try {
    const result = await getECFStatusByTrackId(doc.ecfTrackId);
    if (!result.success) {
      await logEcfEvent({
        documentId: expenseId,
        documentType: 'Expense',
        action: 'CHECK_STATUS',
        status: 'ERROR',
        trackId: doc.ecfTrackId,
        encf: doc.encf,
        message: result.message
      });
      return { success: false, message: result.message };
    }

    const estadoMap: Record<string, string> = {
      '1': 'Aceptado',
      '2': 'Rechazado',
      '3': 'AceptadoCondicional',
      '4': 'Contingencia',
    };
    const ecfStatus = estadoMap[result.codigo || ''] || 'Pendiente';

    await ExpenseModel.findByIdAndUpdate(expenseId, { ecfStatus });
    revalidatePath('/expenses');

    await logEcfEvent({
      documentId: expenseId,
      documentType: 'Expense',
      action: 'CHECK_STATUS',
      status: 'SUCCESS',
      trackId: result.trackId,
      encf: doc.encf,
      message: `Estado DGII: ${result.estado || 'Sin información'}`,
      responsePayload: result
    });

    return { success: true, estado: ecfStatus, trackId: doc.ecfTrackId, message: result.message };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
