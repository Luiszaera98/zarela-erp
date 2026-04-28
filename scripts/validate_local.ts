import * as xlsx from 'xlsx';
import { Transformer } from 'dgii-ecf';

const EXCEL_PATH = '/Users/luiszaera/Downloads/132327179-21042026125215.xlsx';
const workbook = xlsx.readFile(EXCEL_PATH);

function normalizeRow(row: any): any {
    const n: any = {};
    for (const [k, v] of Object.entries(row)) n[k.trim()] = v;
    return n;
}

const ecfRows = xlsx.utils.sheet_to_json(workbook.Sheets['ECF'], { raw: false }).map(normalizeRow);

function get(val: any): string | undefined {
    if (val === undefined || val === null || val === '#e' || val === '') return undefined;
    const str = String(val).trim();
    return str === '' ? undefined : str;
}

// List ALL header-level fields that DGII expects per document
const headerFields = [
    'Version', 'TipoeCF', 'eNCF', 'ENCF',
    'FechaVencimientoSecuencia', 'IndicadorNotaCredito', 'IndicadorEnvioDiferido',
    'IndicadorMontoGravado', 'IndicadorServicioTodoIncluido',
    'TipoIngresos', 'TipoPago', 'FechaLimitePago', 'TerminoPago',
    'TipoCuentaPago', 'NumeroCuentaPago', 'BancoPago',
    'FechaDesde', 'FechaHasta', 'TotalPaginas',
    'RNCEmisor', 'RazonSocialEmisor', 'NombreComercial', 'Sucursal',
    'DireccionEmisor', 'Municipio', 'Provincia', 'CorreoEmisor', 'WebSite',
    'ActividadEconomica', 'CodigoVendedor', 'NumeroFacturaInterna',
    'NumeroPedidoInterno', 'ZonaVenta', 'RutaVenta', 'InformacionAdicionalEmisor',
    'FechaEmision',
    'RNCComprador', 'RazonSocialComprador', 'ContactoComprador', 'CorreoComprador',
    'DireccionComprador', 'MunicipioComprador', 'ProvinciaComprador',
    'IdentificadorExtranjero',
    'FechaEntrega', 'ContactoEntrega', 'DireccionEntrega', 'TelefonoAdicional',
    'FechaOrdenCompra', 'NumeroOrdenCompra', 'CodigoInternoComprador',
    'InformacionAdicionalComprador',
    'Conductor', 'DocumentoTransporte', 'Ficha', 'Placa',
    'RutaTransporte', 'ZonaTransporte', 'NumeroAlbaran',
    'FechaEmbarque', 'NumeroEmbarque', 'NumeroContenedor', 'NumeroReferencia',
    'PesoBruto', 'PesoNeto', 'UnidadPesoBruto', 'UnidadPesoNeto',
    'CantidadBulto', 'UnidadBulto', 'VolumenBulto', 'UnidadVolumen',
    'MontoGravadoTotal', 'MontoGravadoI1', 'MontoGravadoI2', 'MontoGravadoI3',
    'MontoExento', 'ITBIS1', 'ITBIS2', 'ITBIS3',
    'TotalITBIS', 'TotalITBIS1', 'TotalITBIS2', 'TotalITBIS3',
    'MontoImpuestoAdicional', 'MontoTotal', 'MontoNoFacturable',
    'MontoPeriodo', 'SaldoAnterior', 'MontoAvancePago', 'ValorPagar',
    'TotalITBISRetenido', 'TotalISRRetencion', 'TotalITBISPercepcion', 'TotalISRPercepcion',
    'NCFModificado', 'RNCOtroContribuyente', 'FechaNCFModificado',
    'CodigoModificacion', 'RazonModificacion',
    'TipoMoneda', 'TipoCambio', 'MontoGravadoTotalOtraMoneda',
    'MontoGravado3OtraMoneda', 'MontoExentoOtraMoneda',
    'TotalITBISOtraMoneda', 'TotalITBIS3OtraMoneda', 'MontoTotalOtraMoneda',
];

// For each document, show which fields have values in Excel but might be missed by our mapper
for (const row of ecfRows) {
    const encf = row.eNCF || row.ENCF;
    const missingFields: string[] = [];
    
    for (const field of headerFields) {
        const val = get(row[field]);
        if (val !== undefined) {
            // This field has a real value - make sure our mapper can handle it
        }
    }
    
    // Check ALL keys in this row for ones that have values and aren't item-level
    for (const [key, val] of Object.entries(row)) {
        const v = get(val);
        if (v !== undefined && !key.match(/\[\d+\]/) && !headerFields.includes(key) && key !== 'CasoPrueba') {
            missingFields.push(`${key}=${v}`);
        }
    }
    
    if (missingFields.length > 0) {
        console.log(`\n⚠️  ${encf}: UNMAPPED header fields:`);
        missingFields.forEach(f => console.log(`  ${f}`));
    }
}

// Also check for item-level fields we might be missing
const itemFields = [
    'IndicadorFacturacion', 'NombreItem', 'IndicadorBienoServicio', 'DescripcionItem',
    'CantidadItem', 'UnidadMedida', 'CantidadReferencia', 'UnidadReferencia',
    'GradosAlcohol', 'PrecioUnitarioReferencia', 'FechaElaboracion', 'FechaVencimientoItem',
    'PrecioUnitarioItem', 'DescuentoMonto', 'RecargoMonto', 'MontoItem',
    'TipoSubDescuento', 'SubDescuentoPorcentaje', 'MontoSubDescuento',
    'TipoSubRecargo', 'SubRecargoPorcentaje', 'MontosubRecargo',
    'TipoImpuesto', 'TipoCodigo', 'CodigoItem',
    'Subcantidad', 'CodigoSubcantidad',
    'PrecioOtraMoneda', 'DescuentoOtraMoneda', 'RecargoOtraMoneda', 'MontoItemOtraMoneda',
    'TasaImpuestoAdicional', 'MontoImpuestoSelectivoConsumoEspecifico',
    'MontoImpuestoSelectivoConsumoAdvalorem', 'OtrosImpuestosAdicionales',
    'IndicadorAgenteRetencionoPercepcion', 'MontoITBISRetenido', 'MontoISRRetenido',
    'FormaPago', 'MontoPago', 'TelefonoEmisor',
    // Item-level exclusions (already known)
    'PesoNetoKilogramo', 'PesoNetoMineria', 'TipoAfiliacion', 'Liquidacion',
];

const itemFieldBases = new Set(itemFields);
let unmappedItemFields = new Set<string>();

for (const row of ecfRows) {
    for (const [key, val] of Object.entries(row)) {
        const v = get(val);
        if (v !== undefined && key.match(/\[\d+\]/)) {
            const base = key.replace(/\[\d+\]/g, '');
            if (!itemFieldBases.has(base)) {
                unmappedItemFields.add(base);
            }
        }
    }
}

if (unmappedItemFields.size > 0) {
    console.log("\n⚠️  UNMAPPED item-level field bases:");
    [...unmappedItemFields].forEach(f => console.log(`  ${f}`));
}

console.log("\n✅ Validation complete.");
