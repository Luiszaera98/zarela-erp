/**
 * ecfService.ts
 * Servicio singleton para manejar la autenticación y firma de e-CF con la DGII.
 * Solo debe usarse en el servidor (Next.js Server Actions / API Routes).
 */

// Dynamic import to avoid issues in environments without the cert configured
let _ecfInstance: any = null;
let _signatureClass: any = null;
let _certs: { cert: string; key: string } | null = null;
let _initialized = false;

export interface ECFConfig {
  isConfigured: boolean;
  environment: string;
  rncEmisor: string;
  razonSocial: string;
  direccionEmisor?: string;
  municipioEmisor?: string;
  provinciaEmisor?: string;
  telefonoEmisor?: string;
  correoEmisor?: string;
  fechaVencimientoSecuencia?: string;
}

export interface ECFSendResult {
  success: boolean;
  trackId?: string;
  message?: string;
  rawResponse?: any;
}

export interface ECFStatusResult {
  success: boolean;
  estado?: string;
  codigo?: string;
  encf?: string;
  trackId?: string;
  fechaRecepcion?: string;
  mensajes?: { valor: string; codigo: number }[];
  message?: string;
}

/**
 * Devuelve la configuración actual del servicio e-CF.
 */
export function getECFConfig(): ECFConfig {
  const env = process.env.ECF_ENVIRONMENT || 'TesteCF';
  const rnc = process.env.ECF_RNC_EMISOR || '';
  const razonSocial = process.env.ECF_RAZON_SOCIAL || '';
  const certBase64 = process.env.ECF_CERTIFICATE_BASE64 || '';
  const passphrase = process.env.ECF_CERTIFICATE_PASSPHRASE || '';

  return {
    isConfigured: !!(certBase64 && passphrase && rnc),
    environment: env,
    rncEmisor: rnc,
    razonSocial,
    direccionEmisor: process.env.ECF_DIRECCION_EMISOR,
    municipioEmisor: process.env.ECF_MUNICIPIO_EMISOR,
    provinciaEmisor: process.env.ECF_PROVINCIA_EMISOR,
    telefonoEmisor: process.env.ECF_TELEFONO_EMISOR,
    correoEmisor: process.env.ECF_CORREO_EMISOR,
    fechaVencimientoSecuencia: process.env.ECF_FECHA_VENCIMIENTO_SECUENCIA,
  };
}

/**
 * Inicializa el servicio ECF cargando el certificado .p12 desde la variable de entorno.
 * Retorna false si el certificado no está configurado.
 */
async function initECF(): Promise<boolean> {
  if (_initialized) return _ecfInstance !== null;

  const certBase64 = process.env.ECF_CERTIFICATE_BASE64;
  const passphrase = process.env.ECF_CERTIFICATE_PASSPHRASE;
  const environment = process.env.ECF_ENVIRONMENT || 'TesteCF';

  if (!certBase64 || !passphrase) {
    console.warn('[ECF] No certificate configured. Set ECF_CERTIFICATE_BASE64 and ECF_CERTIFICATE_PASSPHRASE.');
    _initialized = true;
    return false;
  }

  try {
    // Dynamic import — dgii-ecf is server-side only
    const { P12Reader, default: ECF, Signature, ENVIRONMENT } = await import('dgii-ecf');

    // Map environment string to ENVIRONMENT enum
    // dgii-ecf uses: DEV = TesteCF, CERT = CerteCF, PROD = eCF
    const envMap: Record<string, any> = {
      'TesteCF': ENVIRONMENT.DEV,
      'CerteCF': ENVIRONMENT.CERT,
      'eCF': ENVIRONMENT.PROD,
    };
    const selectedEnv = envMap[environment] ?? ENVIRONMENT.DEV;

    // Read certificate from base64
    const reader = new P12Reader(passphrase);
    const rawCerts = reader.getKeyFromStringBase64(certBase64);

    if (!rawCerts?.cert || !rawCerts?.key) {
      throw new Error('El certificado .p12 no pudo ser leído. Verifica ECF_CERTIFICATE_BASE64 y ECF_CERTIFICATE_PASSPHRASE.');
    }

    _certs = { cert: rawCerts.cert, key: rawCerts.key };

    _ecfInstance = new ECF(_certs, selectedEnv);
    _signatureClass = Signature;
    _initialized = true;
    console.log(`[ECF] Servicio inicializado correctamente. Ambiente: ${environment}`);
    return true;
  } catch (err: any) {
    console.error('[ECF] Error inicializando el servicio:', err.message);
    _initialized = true;
    return false;
  }
}

/**
 * Autentica con la DGII usando el certificado configurado.
 * Retorna { success, message }
 */
export async function authenticateWithDGII(): Promise<{ success: boolean; message: string }> {
  const ready = await initECF();
  if (!ready || !_ecfInstance) {
    return { success: false, message: 'Certificado no configurado. Agrega ECF_CERTIFICATE_BASE64 y ECF_CERTIFICATE_PASSPHRASE en tu .env.local.' };
  }

  try {
    await _ecfInstance.authenticate();
    return { success: true, message: 'Autenticación con DGII exitosa.' };
  } catch (err: any) {
    return { success: false, message: `Error de autenticación: ${err.message}` };
  }
}

/**
 * Firma un XML con el certificado configurado.
 * @param xml - El XML a firmar
 * @param rootTag - El tag raíz del documento (ej: 'ECF', 'RFCE')
 */
export async function signXML(xml: string, rootTag: string): Promise<string> {
  const ready = await initECF();
  if (!ready || !_certs || !_signatureClass) {
    throw new Error('No se puede firmar: certificado no configurado.');
  }

  const signature = new _signatureClass(_certs.key, _certs.cert);
  return signature.signXml(xml, rootTag);
}

/**
 * Envía un documento e-CF firmado a la DGII.
 * @param signedXml - El XML ya firmado
 * @param fileName - Nombre del archivo (ej: "130862346E310000000001.xml")
 */
export async function sendElectronicDocument(
  signedXml: string,
  fileName: string
): Promise<ECFSendResult> {
  const ready = await initECF();
  if (!ready || !_ecfInstance) {
    return { success: false, message: 'Certificado no configurado.' };
  }

  try {
    await _ecfInstance.authenticate();
    const response = await _ecfInstance.sendElectronicDocument(signedXml, fileName);
    const trackId = response?.trackId || response?.data?.trackId;
    return {
      success: true,
      trackId,
      rawResponse: response,
    };
  } catch (err: any) {
    const errMsg = err?.message || err?.response?.data?.message || JSON.stringify(err?.response?.data) || JSON.stringify(err) || 'Error de comunicación con DGII';
    console.error('[ECF] sendElectronicDocument error:', errMsg, err?.response?.status);
    return { success: false, message: errMsg, rawResponse: err?.response?.data };
  }
}

/**
 * Envía una factura de consumo (E32) como resumen (RFCE) a la DGII.
 */
export async function sendSummaryDocument(
  signedRFCEXml: string,
  fileName: string
): Promise<ECFSendResult> {
  const ready = await initECF();
  if (!ready || !_ecfInstance) {
    return { success: false, message: 'Certificado no configurado.' };
  }

  try {
    await _ecfInstance.authenticate();
    const response = await _ecfInstance.sendSummary(signedRFCEXml, fileName);
    // RFCE responses: { codigo: 1, estado: "Aceptado", encf: "E32...", secuenciaUtilizada: true }
    const trackId = response?.trackId || response?.data?.trackId || response?.encf;
    const isAccepted = response?.estado === 'Aceptado' || response?.codigo === 1;
    return { success: isAccepted, trackId, rawResponse: response };
  } catch (err: any) {
    const errMsg = err?.message || err?.response?.data?.message || JSON.stringify(err?.response?.data) || JSON.stringify(err) || 'Error de comunicación con DGII (RFCE)';
    console.error('[ECF] sendSummaryDocument error:', errMsg, err?.response?.status);
    return { success: false, message: errMsg, rawResponse: err?.response?.data };
  }
}

/**
 * Consulta el estado de un documento e-CF por su TrackId.
 */
export async function getECFStatusByTrackId(trackId: string): Promise<ECFStatusResult> {
  const ready = await initECF();
  if (!ready || !_ecfInstance) {
    return { success: false, message: 'Certificado no configurado.' };
  }

  try {
    await _ecfInstance.authenticate();
    const response = await _ecfInstance.statusTrackId(trackId);
    return {
      success: true,
      trackId: response?.trackId,
      estado: response?.estado,
      codigo: response?.codigo,
      encf: response?.encf,
      fechaRecepcion: response?.fechaRecepcion,
      mensajes: response?.mensajes,
    };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

/**
 * Resets the singleton so it reloads the certificate on next use.
 * Useful for testing or when env vars change.
 */
export function resetECFService() {
  _ecfInstance = null;
  _signatureClass = null;
  _certs = null;
  _initialized = false;
}
