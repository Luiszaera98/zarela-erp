import * as xlsx from 'xlsx';
const path = '/Users/luiszaera/Downloads/132327179-21042026125215.xlsx';
const workbook = xlsx.readFile(path);
const ecfRows = xlsx.utils.sheet_to_json(workbook.Sheets['ECF'], { raw: false });

// Collect ALL unique base field names (removing [N] indices) that have real values
const baseFieldsWithValues = new Set<string>();
for (const row of ecfRows) {
    for (const [key, val] of Object.entries(row as any)) {
        const v = String(val).trim();
        if (v && v !== '#e') {
            const baseKey = key.replace(/\[\d+\]/g, '[*]');
            baseFieldsWithValues.add(baseKey);
        }
    }
}

// Known mapped fields in our script
const mapped = new Set([
    'CasoPrueba', 'Version', 'TipoeCF', 'eNCF', 'ENCF',
    'FechaVencimientoSecuencia', 'IndicadorEnvioDiferido', 'IndicadorMontoGravado',
    'IndicadorServicioTodoIncluido', 'TipoIngresos', 'TipoPago',
    'FechaLimitePago', 'TerminoPago', 'TipoCuentaPago', 'NumeroCuentaPago',
    'BancoPago', 'FechaDesde', 'FechaHasta', 'TotalPaginas',
    'RNCEmisor', 'RazonSocialEmisor', 'NombreComercial', 'Sucursal',
    'DireccionEmisor', 'Municipio', 'Provincia', 'CorreoEmisor', 'WebSite',
    'ActividadEconomica', 'CodigoVendedor', 'NumeroFacturaInterna', 'NumeroFacturaInterno',
    'NumeroPedidoInterno', 'ZonaVenta', 'RutaVenta', 'InformacionAdicionalEmisor', 'FechaEmision',
    'RNCComprador', 'RazonSocialComprador', 'ContactoComprador', 'CorreoComprador', 'Correo',
    'DireccionComprador', 'MunicipioComprador', 'ProvinciaComprador',
    'FechaEntrega', 'ContactoEntrega', 'DireccionEntrega', 'TelefonoAdicional',
    'FechaOrdenCompra', 'NumeroOrdenCompra', 'CodigoInternoComprador',
    'InformacionAdicionalComprador', 'IdentificadorExtranjero',
    'MontoGravadoTotal', 'MontoGravadoI1', 'MontoGravadoI2', 'MontoGravadoI3',
    'MontoExento', 'ITBIS1', 'ITBIS2', 'ITBIS3',
    'TotalITBIS', 'TotalITBIS1', 'TotalITBIS2', 'TotalITBIS3',
    'MontoImpuestoAdicional', 'MontoTotal', 'MontoNoFacturable',
    'MontoPeriodo', 'SaldoAnterior', 'MontoAvancePago', 'ValorPagar',
    'TotalITBISRetenido', 'TotalISRRetencion', 'TotalITBISPercepcion', 'TotalISRPercepcion',
    'NCFModificado', 'RNCOtroContribuyente', 'FechaNCFModificado', 'CodigoModificacion',
    // Item-level
    'NumeroLinea[*]', 'IndicadorFacturacion[*]', 'NombreItem[*]',
    'IndicadorBienoServicio[*]', 'DescripcionItem[*]', 'CantidadItem[*]',
    'UnidadMedida[*]', 'CantidadReferencia[*]', 'UnidadReferencia[*]',
    'GradosAlcohol[*]', 'PrecioUnitarioReferencia[*]',
    'FechaElaboracion[*]', 'FechaVencimientoItem[*]',
    'PrecioUnitarioItem[*]', 'DescuentoMonto[*]', 'RecargoMonto[*]', 'MontoItem[*]',
    'TipoSubDescuento[*][*]', 'SubDescuentoPorcentaje[*][*]', 'MontoSubDescuento[*][*]',
    'TipoSubRecargo[*][*]', 'SubRecargoPorcentaje[*][*]', 'MontosubRecargo[*][*]',
    'TipoImpuesto[*]', 'TasaImpuestoAdicional[*]',
    'MontoImpuestoSelectivoConsumoEspecifico[*]', 'MontoImpuestoSelectivoConsumoAdvalorem[*]',
    'OtrosImpuestosAdicionales[*]',
    'TipoImpuesto[*][*]',
    'IndicadorAgenteRetencionoPercepcion[*]', 'MontoITBISRetenido[*]', 'MontoISRRetenido[*]',
]);

console.log("=== UNMAPPED fields with real values ===");
for (const field of [...baseFieldsWithValues].sort()) {
    if (!mapped.has(field)) {
        console.log(`  ❌ ${field}`);
    }
}
