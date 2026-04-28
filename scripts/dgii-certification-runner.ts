import * as xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { ECF, Signature, Transformer, P12Reader, ENVIRONMENT } from 'dgii-ecf';
import { EcfEmissor } from '../src/lib/ecf/ecfTransformer';

const EXCEL_PATH = '/Users/luiszaera/Downloads/132327179-21042026125215.xlsx';
const PASSWORD = process.env.ECF_CERTIFICATE_PASSPHRASE || process.env.ECF_CERTIFICATE_PASSPHRASE || '';

const emisor: EcfEmissor = {
  RNCEmisor: "132327179",
  RazonSocialEmisor: "INDUSTRIAS MONTERREY SRL",
  DireccionEmisor: "MERCURIO, No. 302, SAN GERONIMO",
  TelefonoEmisor: "8096013269",
  CorreoEmisor: "VENTAS@INDUSTRIASMONTERREY.COM"
};

const p12Path = path.resolve(__dirname, '../cert.p12');
const reader = new P12Reader(PASSWORD);
const certs = reader.getKeyFromFile(p12Path);
const signatureUtil = new Signature(certs.key, certs.cert);
const ecfApi = new ECF(certs, ENVIRONMENT.CERT);
const transformer = new Transformer();

const issuerName = "CN=digifirma CA Subordinada 1, OU=digifirma, O=Cámara de Comercio y Producción de Santo Domingo, L=Distrito Nacional, C=DO, 2.5.4.97=VATDO-40102368";
const serialNumber = "3135179762511420403";
const issuerNode = `\n<X509IssuerSerial>\n  <X509IssuerName>${issuerName}</X509IssuerName>\n  <X509SerialNumber>${serialNumber}</X509SerialNumber>\n</X509IssuerSerial>\n<X509Certificate>`;

// ── Helpers ──────────────────────────────────────────────────────────────
function get(val: any): string | undefined {
    if (val === undefined || val === null || val === '#e' || val === '') return undefined;
    const str = String(val).trim();
    return str === '' ? undefined : str;
}

function clean(obj: any) {
    for (const key of Object.keys(obj)) {
        if (obj[key] === undefined) delete obj[key];
    }
}

// ── Build ECF JSON from one Excel row ────────────────────────────────────
// EVERY section and field follows the EXACT XSD order from IECF.ts
function dgiiRowToJson(row: any) {
    const encf = String(row.eNCF || row.ENCF);
    const tipoeCF = encf.startsWith("E31") ? 31 : encf.startsWith("E32") ? 32 :
                    encf.startsWith("E33") ? 33 : encf.startsWith("E34") ? 34 :
                    encf.startsWith("E41") ? 41 : encf.startsWith("E43") ? 43 :
                    encf.startsWith("E44") ? 44 : encf.startsWith("E45") ? 45 :
                    encf.startsWith("E46") ? 46 : encf.startsWith("E47") ? 47 : 31;

    // ── TablaFormasPago ──
    const formasPago: any[] = [];
    for (let fp = 1; fp <= 5; fp++) {
        if (get(row[`FormaPago[${fp}]`])) {
            formasPago.push({
                FormaPago: get(row[`FormaPago[${fp}]`]),
                MontoPago: get(row[`MontoPago[${fp}]`]),
            });
        }
    }

    // ── IdDoc (order from actual XSD validation) ──
    const idDoc: any = {
        TipoeCF: tipoeCF,
        eNCF: encf,
        FechaVencimientoSecuencia: get(row.FechaVencimientoSecuencia),
        IndicadorNotaCredito: get(row.IndicadorNotaCredito),
        IndicadorEnvioDiferido: get(row.IndicadorEnvioDiferido),
        IndicadorMontoGravado: get(row.IndicadorMontoGravado),
        IndicadorServicioTodoIncluido: get(row.IndicadorServicioTodoIncluido),
        TipoIngresos: get(row.TipoIngresos),
        TipoPago: get(row.TipoPago),
        FechaLimitePago: get(row.FechaLimitePago),
        TerminoPago: get(row.TerminoPago),
        TablaFormasPago: formasPago.length > 0 ? { FormaDePago: formasPago } : undefined,
        TipoCuentaPago: get(row.TipoCuentaPago),
        NumeroCuentaPago: get(row.NumeroCuentaPago),
        BancoPago: get(row.BancoPago),
        FechaDesde: get(row.FechaDesde),
        FechaHasta: get(row.FechaHasta),
        TotalPaginas: get(row.TotalPaginas),
    };
    clean(idDoc);

    // ── Emisor (XSD order) ──
    // TablaTelefonoEmisor
    const telefonos: any[] = [];
    for (let t = 1; t <= 3; t++) {
        if (get(row[`TelefonoEmisor[${t}]`])) {
            telefonos.push(get(row[`TelefonoEmisor[${t}]`]));
        }
    }

    const emisorObj: any = {
        RNCEmisor: get(row.RNCEmisor) || emisor.RNCEmisor,
        RazonSocialEmisor: get(row.RazonSocialEmisor),
        NombreComercial: get(row.NombreComercial),
        Sucursal: get(row.Sucursal),
        DireccionEmisor: get(row.DireccionEmisor),
        Municipio: get(row.Municipio),
        Provincia: get(row.Provincia),
        TablaTelefonoEmisor: telefonos.length > 0 ? { TelefonoEmisor: telefonos } : undefined,
        CorreoEmisor: get(row.CorreoEmisor),
        WebSite: get(row.WebSite),
        ActividadEconomica: get(row.ActividadEconomica),
        CodigoVendedor: get(row.CodigoVendedor),
        NumeroFacturaInterna: get(row.NumeroFacturaInterna) || get(row.NumeroFacturaInterno),
        NumeroPedidoInterno: get(row.NumeroPedidoInterno),
        ZonaVenta: get(row.ZonaVenta),
        RutaVenta: get(row.RutaVenta),
        InformacionAdicionalEmisor: get(row.InformacionAdicionalEmisor),
        FechaEmision: get(row.FechaEmision) || "01-04-2020",
    };
    clean(emisorObj);

    // ── Comprador (order from ecf-references/ecf.ts) ──
    const comprador: any = {
        RNCComprador: get(row.RNCComprador) || get(row.RNCOtroContribuyente),
        IdentificadorExtranjero: get(row.IdentificadorExtranjero),
        RazonSocialComprador: get(row.RazonSocialComprador),
        ContactoComprador: get(row.ContactoComprador),
        CorreoComprador: get(row.CorreoComprador) || get(row.Correo),
        DireccionComprador: get(row.DireccionComprador),
        MunicipioComprador: get(row.MunicipioComprador),
        ProvinciaComprador: get(row.ProvinciaComprador),
        FechaEntrega: get(row.FechaEntrega),
        ContactoEntrega: get(row.ContactoEntrega),
        DireccionEntrega: get(row.DireccionEntrega),
        TelefonoAdicional: get(row.TelefonoAdicional),
        FechaOrdenCompra: get(row.FechaOrdenCompra),
        NumeroOrdenCompra: get(row.NumeroOrdenCompra),
        CodigoInternoComprador: get(row.CodigoInternoComprador),
        InformacionAdicionalComprador: get(row.InformacionAdicionalComprador),
    };
    clean(comprador);

    // ── InformacionesAdicionales (XSD order) ──
    const infoAdicional: any = {
        FechaEmbarque: get(row.FechaEmbarque),
        NumeroEmbarque: get(row.NumeroEmbarque),
        NumeroContenedor: get(row.NumeroContenedor),
        NumeroReferencia: get(row.NumeroReferencia),
        PesoBruto: get(row.PesoBruto),
        PesoNeto: get(row.PesoNeto),
        UnidadPesoBruto: get(row.UnidadPesoBruto),
        UnidadPesoNeto: get(row.UnidadPesoNeto),
        CantidadBulto: get(row.CantidadBulto),
        UnidadBulto: get(row.UnidadBulto),
        VolumenBulto: get(row.VolumenBulto),
        UnidadVolumen: get(row.UnidadVolumen),
    };
    clean(infoAdicional);

    // ── Transporte (XSD order) ──
    const transporte: any = {
        Conductor: get(row.Conductor),
        DocumentoTransporte: get(row.DocumentoTransporte),
        Ficha: get(row.Ficha),
        Placa: get(row.Placa),
        RutaTransporte: get(row.RutaTransporte),
        ZonaTransporte: get(row.ZonaTransporte),
        NumeroAlbaran: get(row.NumeroAlbaran),
    };
    clean(transporte);

    // ── ImpuestosAdicionales (build before Totales) ──
    const impuestosAdicionales: any[] = [];
    for (let j = 1; j <= 5; j++) {
        if (get(row[`TipoImpuesto[${j}]`])) {
            const impObj: any = {
                TipoImpuesto: get(row[`TipoImpuesto[${j}]`]),
                TasaImpuestoAdicional: get(row[`TasaImpuestoAdicional[${j}]`]),
                MontoImpuestoSelectivoConsumoEspecifico: get(row[`MontoImpuestoSelectivoConsumoEspecifico[${j}]`]),
                MontoImpuestoSelectivoConsumoAdvalorem: get(row[`MontoImpuestoSelectivoConsumoAdvalorem[${j}]`]),
                OtrosImpuestosAdicionales: get(row[`OtrosImpuestosAdicionales[${j}]`]),
            };
            clean(impObj);
            impuestosAdicionales.push(impObj);
        }
    }

    // ── Totales (XSD order) ──
    const totales: any = {
        MontoGravadoTotal: get(row.MontoGravadoTotal),
        MontoGravadoI1: get(row.MontoGravadoI1),
        MontoGravadoI2: get(row.MontoGravadoI2),
        MontoGravadoI3: get(row.MontoGravadoI3),
        MontoExento: get(row.MontoExento),
        ITBIS1: get(row.ITBIS1),
        ITBIS2: get(row.ITBIS2),
        ITBIS3: get(row.ITBIS3),
        TotalITBIS: get(row.TotalITBIS),
        TotalITBIS1: get(row.TotalITBIS1),
        TotalITBIS2: get(row.TotalITBIS2),
        TotalITBIS3: get(row.TotalITBIS3),
        MontoImpuestoAdicional: get(row.MontoImpuestoAdicional),
        ImpuestosAdicionales: impuestosAdicionales.length > 0 ? { ImpuestoAdicional: impuestosAdicionales } : undefined,
        MontoTotal: get(row.MontoTotal),
        MontoNoFacturable: get(row.MontoNoFacturable),
        MontoPeriodo: get(row.MontoPeriodo),
        SaldoAnterior: get(row.SaldoAnterior),
        MontoAvancePago: get(row.MontoAvancePago),
        ValorPagar: get(row.ValorPagar),
        TotalITBISRetenido: get(row.TotalITBISRetenido),
        TotalISRRetencion: get(row.TotalISRRetencion),
        TotalITBISPercepcion: get(row.TotalITBISPercepcion),
        TotalISRPercepcion: get(row.TotalISRPercepcion),
    };
    clean(totales);

    // ── OtraMoneda (XSD order) ──
    const otraMoneda: any = {
        TipoMoneda: get(row.TipoMoneda),
        TipoCambio: get(row.TipoCambio),
        MontoGravadoTotalOtraMoneda: get(row.MontoGravadoTotalOtraMoneda),
        MontoGravado1OtraMoneda: get(row.MontoGravado1OtraMoneda),
        MontoGravado2OtraMoneda: get(row.MontoGravado2OtraMoneda),
        MontoGravado3OtraMoneda: get(row.MontoGravado3OtraMoneda),
        MontoExentoOtraMoneda: get(row.MontoExentoOtraMoneda),
        TotalITBISOtraMoneda: get(row.TotalITBISOtraMoneda),
        TotalITBIS1OtraMoneda: get(row.TotalITBIS1OtraMoneda),
        TotalITBIS2OtraMoneda: get(row.TotalITBIS2OtraMoneda),
        TotalITBIS3OtraMoneda: get(row.TotalITBIS3OtraMoneda),
        MontoImpuestoAdicionalOtraMoneda: get(row.MontoImpuestoAdicionalOtraMoneda),
        MontoTotalOtraMoneda: get(row.MontoTotalOtraMoneda),
    };
    clean(otraMoneda);

    // ── Encabezado (XSD order) ──
    const encabezado: any = {
        Version: "1.0",
        IdDoc: idDoc,
        Emisor: emisorObj,
        Comprador: Object.keys(comprador).length > 0 ? comprador : undefined,
        InformacionesAdicionales: Object.keys(infoAdicional).length > 0 ? infoAdicional : undefined,
        Transporte: Object.keys(transporte).length > 0 ? transporte : undefined,
        Totales: totales,
        OtraMoneda: Object.keys(otraMoneda).length > 0 ? otraMoneda : undefined,
    };
    clean(encabezado);

    // ── Items (XSD order from IECF.ts lines 199-224) ──
    const items: any[] = [];
    for (let k = 1; k <= 100; k++) {
        if (row[`NombreItem[${k}]`] && row[`NombreItem[${k}]`] !== '#e') {
            // TablaCodigosItem
            const codigosItem: any[] = [];
            for (let ci = 1; ci <= 5; ci++) {
                if (get(row[`TipoCodigo[${k}][${ci}]`])) {
                    codigosItem.push({
                        TipoCodigo: get(row[`TipoCodigo[${k}][${ci}]`]),
                        CodigoItem: get(row[`CodigoItem[${k}][${ci}]`]),
                    });
                }
            }

            // Retencion
            const retencion: any = {
                IndicadorAgenteRetencionoPercepcion: get(row[`IndicadorAgenteRetencionoPercepcion[${k}]`]),
                MontoITBISRetenido: get(row[`MontoITBISRetenido[${k}]`]),
                MontoISRRetenido: get(row[`MontoISRRetenido[${k}]`]),
            };
            clean(retencion);

            // TablaSubcantidad
            const subcantidades: any[] = [];
            for (let sc = 1; sc <= 5; sc++) {
                if (get(row[`Subcantidad[${k}][${sc}]`])) {
                    subcantidades.push({
                        Subcantidad: get(row[`Subcantidad[${k}][${sc}]`]),
                        CodigoSubcantidad: get(row[`CodigoSubcantidad[${k}][${sc}]`]),
                    });
                }
            }

            // TablaSubDescuento
            const subDescuentos: any[] = [];
            for (let sd = 1; sd <= 5; sd++) {
                if (get(row[`TipoSubDescuento[${k}][${sd}]`])) {
                    const sdObj: any = {
                        TipoSubDescuento: get(row[`TipoSubDescuento[${k}][${sd}]`]),
                        SubDescuentoPorcentaje: get(row[`SubDescuentoPorcentaje[${k}][${sd}]`]),
                        MontoSubDescuento: get(row[`MontoSubDescuento[${k}][${sd}]`]),
                    };
                    clean(sdObj);
                    subDescuentos.push(sdObj);
                }
            }

            // TablaSubRecargo
            const subRecargos: any[] = [];
            for (let sr = 1; sr <= 5; sr++) {
                if (get(row[`TipoSubRecargo[${k}][${sr}]`])) {
                    const srObj: any = {
                        TipoSubRecargo: get(row[`TipoSubRecargo[${k}][${sr}]`]),
                        SubRecargoPorcentaje: get(row[`SubRecargoPorcentaje[${k}][${sr}]`]),
                        MontoSubRecargo: get(row[`MontosubRecargo[${k}][${sr}]`]),
                    };
                    clean(srObj);
                    subRecargos.push(srObj);
                }
            }

            // TablaImpuestoAdicional (item-level)
            const itemImpuestos: any[] = [];
            for (let ti = 1; ti <= 5; ti++) {
                if (get(row[`TipoImpuesto[${k}][${ti}]`])) {
                    itemImpuestos.push({ TipoImpuesto: get(row[`TipoImpuesto[${k}][${ti}]`]) });
                }
            }

            // OtraMonedaDetalle
            const otraMonedaDet: any = {
                PrecioOtraMoneda: get(row[`PrecioOtraMoneda[${k}]`]),
                DescuentoOtraMoneda: get(row[`DescuentoOtraMoneda[${k}]`]),
                RecargoOtraMoneda: get(row[`RecargoOtraMoneda[${k}]`]),
                MontoItemOtraMoneda: get(row[`MontoItemOtraMoneda[${k}]`]),
            };
            clean(otraMonedaDet);

            // ── Item object (STRICT XSD order) ──
            const itemObj: any = {
                NumeroLinea: k,
                TablaCodigosItem: codigosItem.length > 0 ? { CodigosItem: codigosItem } : undefined,
                IndicadorFacturacion: get(row[`IndicadorFacturacion[${k}]`]),
                Retencion: Object.keys(retencion).length > 0 ? retencion : undefined,
                NombreItem: get(row[`NombreItem[${k}]`]),
                IndicadorBienoServicio: get(row[`IndicadorBienoServicio[${k}]`]),
                DescripcionItem: get(row[`DescripcionItem[${k}]`]),
                CantidadItem: get(row[`CantidadItem[${k}]`]),
                UnidadMedida: get(row[`UnidadMedida[${k}]`]),
                CantidadReferencia: get(row[`CantidadReferencia[${k}]`]),
                UnidadReferencia: get(row[`UnidadReferencia[${k}]`]),
                TablaSubcantidad: subcantidades.length > 0 ? { SubcantidadItem: subcantidades } : undefined,
                GradosAlcohol: get(row[`GradosAlcohol[${k}]`]),
                PrecioUnitarioReferencia: get(row[`PrecioUnitarioReferencia[${k}]`]),
                FechaElaboracion: get(row[`FechaElaboracion[${k}]`]),
                FechaVencimientoItem: get(row[`FechaVencimientoItem[${k}]`]),
                PrecioUnitarioItem: get(row[`PrecioUnitarioItem[${k}]`]),
                DescuentoMonto: get(row[`DescuentoMonto[${k}]`]),
                TablaSubDescuento: subDescuentos.length > 0 ? { SubDescuento: subDescuentos } : undefined,
                RecargoMonto: get(row[`RecargoMonto[${k}]`]),
                TablaSubRecargo: subRecargos.length > 0 ? { SubRecargo: subRecargos } : undefined,
                TablaImpuestoAdicional: itemImpuestos.length > 0 ? { ImpuestoAdicional: itemImpuestos } : undefined,
                OtraMonedaDetalle: Object.keys(otraMonedaDet).length > 0 ? otraMonedaDet : undefined,
                MontoItem: get(row[`MontoItem[${k}]`]),
            };
            clean(itemObj);
            items.push(itemObj);
        }
    }

    // Fallback item
    if (items.length === 0) {
        items.push({
            NumeroLinea: 1,
            IndicadorFacturacion: 1,
            NombreItem: "Servicio Generico",
            CantidadItem: "1.00",
            PrecioUnitarioItem: get(row.MontoTotal),
            MontoItem: get(row.MontoTotal),
        });
    }

    // ── InformacionReferencia (for NC/ND) ──
    let infoRef: any = undefined;
    if (encf.startsWith('E33') || encf.startsWith('E34')) {
        infoRef = {
            NCFModificado: get(row.NCFModificado),
            RNCOtroContribuyente: get(row.RNCOtroContribuyente),
            FechaNCFModificado: get(row.FechaNCFModificado),
            CodigoModificacion: get(row.CodigoModificacion),
            RazonModificacion: get(row.RazonModificacion),
        };
        clean(infoRef);
    }

    // ── Final ECF structure (XSD order) ──
    const ecf: any = {
        Encabezado: encabezado,
        DetallesItems: { Item: items },
    };
    if (infoRef && Object.keys(infoRef).length > 0) ecf.InformacionReferencia = infoRef;
    ecf.FechaHoraFirma = "01-04-2026 12:00:00";

    return { ECF: ecf };
}

// ── Main runner ──────────────────────────────────────────────────────────
async function run() {
    console.log("Iniciando Runner Certificación DGII...\n");
    
    try {
        console.log("Obteniendo token de autorización (Semilla)...");
        await ecfApi.authenticate();
        console.log("✅ Autenticado exitosamente en CerteCF.");
    } catch (e: any) {
        console.error("❌ Falla crítica de autenticación:", e.message);
        return;
    }
    
    const workbook = xlsx.readFile(EXCEL_PATH);

    // Normalize all row keys: trim whitespace from column names
    function normalizeRow(row: any): any {
        const normalized: any = {};
        for (const [key, val] of Object.entries(row)) {
            normalized[key.trim()] = val;
        }
        return normalized;
    }

    const rfceRows = xlsx.utils.sheet_to_json(workbook.Sheets['RFCE'], { raw: false }).map(normalizeRow);
    const ecfRows = xlsx.utils.sheet_to_json(workbook.Sheets['ECF'], { raw: false }).map(normalizeRow);

    let batch1: any[] = [];
    let batch2: any[] = [];
    let batch4: any[] = [];

    for (const row of ecfRows) {
        const type = String((row as any).TipoeCF);
        const totalStr = String((row as any).MontoTotal || "0");
        const total = parseFloat(totalStr);
        
        if (type === '33' || type === '34') {
            batch2.push(row);
        } else if (type === '32' && total < 250000) {
            batch4.push(row);
        } else {
            batch1.push(row);
        }
    }

    async function processBatch(name: string, rows: any[], isRFCE = false) {
        console.log(`\n=== Procesando Batch: ${name} (${rows.length} comprobantes) ===`);
        for (const row of rows) {
            const type = String(row.TipoeCF);
            const encf = String(row.eNCF || row.ENCF);
            try {
                process.stdout.write(` > ${encf} (T${type})... `);
                
                const jsonDoc = dgiiRowToJson(row);
                const xmlUnsigned = transformer.json2xml(jsonDoc);
                
                let signedXml = signatureUtil.signXml(xmlUnsigned, 'ECF');
                if (!signedXml.includes('<X509IssuerSerial>')) {
                    signedXml = signedXml.replace('<X509Certificate>', issuerNode);
                }

                const fileName = `${emisor.RNCEmisor}${encf}.xml`;

                if (isRFCE) {
                    const { convertECF32ToRFCE } = await import('dgii-ecf');
                    const DataRFCE = convertECF32ToRFCE(signedXml);
                    let signedRFCEXml = signatureUtil.signXml(DataRFCE.xml, 'RFCE');
                    if (!signedRFCEXml.includes('<X509IssuerSerial>')) {
                        signedRFCEXml = signedRFCEXml.replace('<X509Certificate>', issuerNode);
                    }
                    const res: any = await ecfApi.sendSummary(signedRFCEXml, fileName);
                    console.log(`Aceptado (TrackID: ${res?.trackId || res?.data?.trackId || JSON.stringify(res)})`);
                } else {
                    const res: any = await ecfApi.sendElectronicDocument(signedXml, fileName);
                    console.log(`Aceptado (TrackID: ${res.trackId})`);
                }
                
            } catch (err: any) {
                console.log(`❌ ERROR: ${err.message}`);
            }
            await new Promise(r => setTimeout(r, 1500));
        }
    }

    // ── Execute all 4 batches ──
    await processBatch("PRIMER BATCH (Facturas Regulares)", batch1);
    await new Promise(r => setTimeout(r, 4000));

    await processBatch("SEGUNDO BATCH (Notas de Crédito/Débito)", batch2);
    await new Promise(r => setTimeout(r, 4000));

    // ── Batch 3 & 4: Resúmenes RFCE & Facturas Consumo < 250k ──
    // Important: To ensure the SignatureValue matches in both, we must generate and sign the ECF32 ONCE,
    // save it to disk (Batch 4), and then extract its RFCE (Batch 3) and send the RFCE immediately.
    const outputDir = path.resolve(__dirname, '../dgii_batch4_xmls');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    
    console.log(`\n=== TERCER Y CUARTO BATCH: Resúmenes RFCE API y Generación de XMLs manuales (${batch4.length} comprobantes) ===`);
    const { convertECF32ToRFCE } = await import('dgii-ecf');
    
    for (const row of batch4) {
        const encf = String(row.eNCF || row.ENCF);
        try {
            process.stdout.write(` > ${encf} (T32 < 250k)... `);
            
            // 1. Generate & Sign ECF32 (Factura)
            const jsonDoc = dgiiRowToJson(row);
            const xmlUnsigned = transformer.json2xml(jsonDoc);
            let signedXml = signatureUtil.signXml(xmlUnsigned, 'ECF');
            if (!signedXml.includes('<X509IssuerSerial>')) {
                signedXml = signedXml.replace('<X509Certificate>', issuerNode);
            }
            
            // 2. Save it to disk for manual upload
            const fileName = `${emisor.RNCEmisor}${encf}.xml`;
            const filePath = path.join(outputDir, fileName);
            fs.writeFileSync(filePath, signedXml, 'utf-8');
            
            // 3. Extract RFCE from that exact signed Factura string
            const DataRFCE = convertECF32ToRFCE(signedXml);
            let signedRFCEXml = signatureUtil.signXml(DataRFCE.xml, 'RFCE');
            if (!signedRFCEXml.includes('<X509IssuerSerial>')) {
                signedRFCEXml = signedRFCEXml.replace('<X509Certificate>', issuerNode);
            }
            
            // 4. Send the Summary to DGII
            const res: any = await ecfApi.sendSummary(signedRFCEXml, fileName);
            console.log(`Aceptado RFCE (TrackID: ${res?.trackId || res?.data?.trackId || JSON.stringify(res)}) + Guardado XML en disco.`);
        } catch (err: any) {
            console.log(`❌ ERROR en ${encf}: ${err.message}`);
        }
        await new Promise(r => setTimeout(r, 1500));
    }
    console.log(`\n📂 Los ${batch4.length} XMLs manuales están en: ${outputDir}`);
    console.log(`📌 Primero verifica que los RFCE enviaron exitosamente. Luego sube estos archivos en el portal DGII → "Facturas de consumo < 250Mil" → "Elegir archivo"`);
}

run().catch(console.error);
