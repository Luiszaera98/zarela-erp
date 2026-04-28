import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { ECF, Signature, Transformer, P12Reader, ENVIRONMENT, convertECF32ToRFCE } from 'dgii-ecf';
import { buildECFJson, EcfEmissor, ECFBuildOptions } from '../src/lib/ecf/ecfTransformer';

// ── Config ──
const MONGODB_URI = '' + (process.env.MONGODB_URI || 'mongodb://localhost:27017/zarela_erp') + '';
const PASSWORD = process.env.ECF_CERTIFICATE_PASSPHRASE || process.env.ECF_CERTIFICATE_PASSPHRASE || '';
const RFCE_THRESHOLD = 250000;

const emisor: EcfEmissor = {
  RNCEmisor: "132327179",
  RazonSocialEmisor: "INDUSTRIAS MONTERREY SRL",
  NombreComercial: "INDUSTRIAS MONTERREY SRL",
  DireccionEmisor: "MERCURIO, No. 302, SAN GERONIMO",
  Municipio: "010101",
  Provincia: "010000",
  TelefonoEmisor: "809-601-3269",
  CorreoEmisor: "VENTAS@INDUSTRIASMONTERREY.COM",
};

// ── Crypto setup ──
const p12Path = path.resolve(__dirname, '../cert.p12');
const reader = new P12Reader(PASSWORD);
const certs = reader.getKeyFromFile(p12Path);
const signatureUtil = new Signature(certs.key, certs.cert);
const ecfApi = new ECF(certs, ENVIRONMENT.CERT);
const transformer = new Transformer();

const issuerName = "CN=digifirma CA Subordinada 1, OU=digifirma, O=Cámara de Comercio y Producción de Santo Domingo, L=Distrito Nacional, C=DO, 2.5.4.97=VATDO-40102368";
const serialNumber = "3135179762511420403";
const issuerNode = `\n<X509IssuerSerial>\n  <X509IssuerName>${issuerName}</X509IssuerName>\n  <X509SerialNumber>${serialNumber}</X509SerialNumber>\n</X509IssuerSerial>\n<X509Certificate>`;

function patchSignature(xml: string): string {
  if (!xml.includes('<X509IssuerSerial>')) {
    return xml.replace('<X509Certificate>', issuerNode);
  }
  return xml;
}

// ── Helpers ──
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function extractSecurityCode(xml: string): string {
  const match = xml.match(/<CodigoSeguridad>([^<]+)<\/CodigoSeguridad>/);
  return match?.[1] || '';
}

// ── Send single document ──
async function sendDoc(doc: any, ncfType: string, isExpense: boolean, originalInvoice?: any) {
  const encf = doc.encf || doc.ncf;
  process.stdout.write(`  > ${encf} (${ncfType}) `);

  try {
    // Build options
    const buildOptions: ECFBuildOptions = {
      fechaVencimientoSecuencia: '31-12-2028',
    };

    // For NC/ND, add reference info
    if (['E33', 'E34'].includes(ncfType) && originalInvoice) {
      buildOptions.encfAfectado = originalInvoice.encf || originalInvoice.ncf;
      buildOptions.fechaNCFModificado = originalInvoice.date;
      buildOptions.codigoModificacion = doc.codigoModificacion || (ncfType === 'E34' ? 1 : 3);
      buildOptions.razonCorreccion = doc.reason || 'Ajuste comercial';
    }

    // Build JSON
    const ecfJson = buildECFJson(doc, encf, emisor, buildOptions);

    // JSON → XML
    const xmlUnsigned = transformer.json2xml(ecfJson);
    if (!xmlUnsigned) throw new Error('json2xml devolvió null');

    // Sign
    let signedXml = signatureUtil.signXml(xmlUnsigned, 'ECF');
    signedXml = patchSignature(signedXml);

    const securityCode = extractSecurityCode(signedXml);
    const fileName = `${emisor.RNCEmisor}${encf}.xml`;

    // Determine send method
    const isRFCE = ncfType === 'E32' && doc.total < RFCE_THRESHOLD;
    let trackId: string | undefined;
    let status = 'Pendiente';

    if (isRFCE) {
      // RFCE flow
      const DataRFCE = convertECF32ToRFCE(signedXml);
      let signedRFCEXml = signatureUtil.signXml(DataRFCE.xml, 'RFCE');
      signedRFCEXml = patchSignature(signedRFCEXml);

      const res: any = await ecfApi.sendSummary(signedRFCEXml, fileName);
      trackId = res?.encf || res?.trackId;
      status = res?.estado === 'Aceptado' ? 'Aceptado' : 'Rechazado';
      
      // Save XML for manual upload
      const outputDir = path.resolve(__dirname, '../dgii_rfce_xmls');
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
      fs.writeFileSync(path.join(outputDir, fileName), signedXml, 'utf-8');
      
      console.log(`→ RFCE ${status} ${res?.estado === 'Aceptado' ? '✅' : '❌ ' + JSON.stringify(res?.mensajes)}`);
    } else if (isExpense) {
      // Expense: send as electronic document
      const res: any = await ecfApi.sendElectronicDocument(signedXml, fileName);
      trackId = res?.trackId;
      console.log(`→ Enviado ✅ (TrackId: ${trackId})`);
    } else {
      // Regular invoice
      const res: any = await ecfApi.sendElectronicDocument(signedXml, fileName);
      trackId = res?.trackId;
      console.log(`→ Enviado ✅ (TrackId: ${trackId})`);
    }

    // Update MongoDB
    const collection = isExpense ? 'expenses' 
      : ncfType === 'E34' ? 'creditnotes'
      : ncfType === 'E33' ? 'debitnotes'
      : 'invoices';
    
    await mongoose.connection.db.collection(collection).updateOne(
      { _id: doc._id },
      { $set: {
        ecfStatus: status,
        ecfTrackId: trackId,
        ecfSignedXml: signedXml,
        ecfFechaFirma: new Date().toISOString(),
        ecfCodigoSeguridad: securityCode,
      }}
    );

    return { success: true, trackId };
  } catch (err: any) {
    console.log(`→ ❌ ERROR: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// ── Main ──
async function run() {
  console.log("═══════════════════════════════════════");
  console.log("  ENVÍO MASIVO e-CF - Paso 4 DGII");
  console.log("═══════════════════════════════════════\n");

  // Connect to MongoDB
  await mongoose.connect(MONGODB_URI, { dbName: 'zarela_erp' });
  console.log("✅ Conectado a MongoDB\n");

  const db = mongoose.connection.db;

  // Authenticate with DGII
  console.log("Autenticando con DGII...");
  await ecfApi.authenticate();
  console.log("✅ Autenticado en CerteCF\n");

  // ── BATCH 1: E31 (Facturas de Crédito Fiscal) ──
  console.log("── BATCH 1: E31 (Facturas de Crédito Fiscal) ──");
  const e31Docs = await db.collection('invoices').find({ ncfType: 'E31' }).sort({ createdAt: 1 }).toArray();
  for (const doc of e31Docs) {
    await sendDoc(doc, 'E31', false);
    await sleep(2000);
  }

  // ── BATCH 2: E33 (Nota de Débito) + E34 (Notas de Crédito) ──
  console.log("\n── BATCH 2: E33 + E34 (Notas) ──");
  
  const e33Docs = await db.collection('debitnotes').find({ ncfType: 'E33' }).toArray();
  for (const doc of e33Docs) {
    const orig = await db.collection('invoices').findOne({ _id: new mongoose.Types.ObjectId(doc.originalInvoiceId) });
    await sendDoc(doc, 'E33', false, orig);
    await sleep(2000);
  }

  const e34Docs = await db.collection('creditnotes').find({ ncfType: 'E34' }).toArray();
  for (const doc of e34Docs) {
    const orig = await db.collection('invoices').findOne({ _id: new mongoose.Types.ObjectId(doc.originalInvoiceId) });
    await sendDoc(doc, 'E34', false, orig);
    await sleep(2000);
  }

  // ── BATCH 3: E32 >= 250K ──
  console.log("\n── BATCH 3: E32 >= 250K ──");
  const e32BigDocs = await db.collection('invoices').find({ ncfType: 'E32', total: { $gte: RFCE_THRESHOLD } }).toArray();
  for (const doc of e32BigDocs) {
    await sendDoc(doc, 'E32', false);
    await sleep(2000);
  }

  // ── BATCH 4: E44, E45, E46 ──
  console.log("\n── BATCH 4: E44, E45, E46 ──");
  for (const tipo of ['E44', 'E45', 'E46']) {
    const docs = await db.collection('invoices').find({ ncfType: tipo }).toArray();
    for (const doc of docs) {
      await sendDoc(doc, tipo, false);
      await sleep(2000);
    }
  }

  // ── BATCH 5: Gastos (E41, E43, E47) ──
  console.log("\n── BATCH 5: Gastos (E41, E43, E47) ──");
  for (const tipo of ['E41', 'E43', 'E47']) {
    const docs = await db.collection('expenses').find({ ncfType: tipo }).toArray();
    for (const doc of docs) {
      await sendDoc(doc, tipo, true);
      await sleep(2000);
    }
  }

  // ── BATCH 6: E32 < 250K (RFCE) ──
  console.log("\n── BATCH 6: E32 < 250K (RFCE) ──");
  const e32SmallDocs = await db.collection('invoices').find({ ncfType: 'E32', total: { $lt: RFCE_THRESHOLD } }).toArray();
  for (const doc of e32SmallDocs) {
    await sendDoc(doc, 'E32', false);
    await sleep(2000);
  }

  console.log("\n═══════════════════════════════════════");
  console.log("  ✅ ENVÍO COMPLETO");
  console.log("═══════════════════════════════════════");
  console.log("\n📂 XMLs de RFCE guardados en: dgii_rfce_xmls/");
  console.log("📌 Sube esos XMLs al portal DGII → 'Facturas de consumo < 250Mil'");

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error("❌ Error fatal:", err);
  process.exit(1);
});
