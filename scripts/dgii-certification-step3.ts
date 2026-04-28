import * as xlsx from 'xlsx';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { ECF, P12Reader, ENVIRONMENT, Transformer, Signature } from 'dgii-ecf';

// Load env
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const EXCEL_PATH = '/Users/luiszaera/Downloads/132327179-21042026185634.xlsx';
const PASSWORD = process.env.ECF_CERTIFICATE_PASSPHRASE || process.env.ECF_CERTIFICATE_PASSPHRASE || '';
const p12Path = path.resolve(__dirname, '../cert.p12');

const reader = new P12Reader(PASSWORD);
const certs = reader.getKeyFromFile(p12Path);
const signatureUtil = new Signature(certs.key, certs.cert);
const ecfApi = new ECF(certs, ENVIRONMENT.CERT);
const transformer = new Transformer();

const issuerName = "CN=digifirma CA Subordinada 1, OU=digifirma, O=Cámara de Comercio y Producción de Santo Domingo, L=Distrito Nacional, C=DO, 2.5.4.97=VATDO-40102368";
const serialNumber = "3135179762511420403";
const issuerNode = `\n<X509IssuerSerial>\n  <X509IssuerName>${issuerName}</X509IssuerName>\n  <X509SerialNumber>${serialNumber}</X509SerialNumber>\n</X509IssuerSerial>\n<X509Certificate>`;

async function run() {
    console.log("Iniciando Paso 3: Aprobación Comercial...\n");
    
    console.log("Autenticando en DGII...");
    await ecfApi.authenticate();
    console.log("✅ Autenticado exitosamente.\n");

    const workbook = xlsx.readFile(EXCEL_PATH);
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets['ACEECF_Generadas'], { raw: false });
    
    console.log(`Encontradas ${rows.length} aprobaciones para procesar.\n`);

    for (const row of rows as any[]) {
        const encf = String(row.eNCF).trim();
        try {
            process.stdout.write(` > Procesando ${encf}... `);
            
            // Build ACECF JSON exactly matching schema
            const jsonDoc = {
                ACECF: {
                    DetalleAprobacionComercial: {
                        Version: "1.0",
                        RNCEmisor: String(row.RNCEmisor).trim(),
                        eNCF: encf,
                        FechaEmision: String(row.FechaEmision).trim(),
                        MontoTotal: String(row.MontoTotal).trim(),
                        RNCComprador: String(row.RNCComprador).trim(),
                        Estado: String(row.Estado).trim(),
                        FechaHoraAprobacionComercial: String(row.FechaHoraAprobacionComercial).trim()
                    }
                }
            };

            const xmlUnsigned = transformer.json2xml(jsonDoc);
            let signedXml = signatureUtil.signXml(xmlUnsigned, 'ACECF');
            
            // Inject issuer properly since the internal package doesn't support custom Issuer tags well
            if (!signedXml.includes('<X509IssuerSerial>')) {
                signedXml = signedXml.replace('<X509Certificate>', issuerNode);
            }
            
            const fileName = `${row.RNCEmisor}${encf}.xml`;
            const res: any = await ecfApi.sendCommercialApproval(signedXml, fileName);
            
            console.log(`✅ Aceptado (TrackID: ${res?.trackId || res?.data?.trackId || JSON.stringify(res)})`);
        } catch (err: any) {
            console.log(`❌ ERROR: ${err.message}`);
            if (err.response) {
                console.log(err.response.data);
            }
        }
        await new Promise(r => setTimeout(r, 1500)); // Delay to be safe from limits
    }
    
    console.log("\nProceso finalizado. Verifica el portal de DGII.");
}

run().catch(console.error);
