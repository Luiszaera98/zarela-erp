import * as xlsx from 'xlsx';
const path = '/Users/luiszaera/Downloads/132327179-21042026125215.xlsx';
const workbook = xlsx.readFile(path);
const ecfRows = xlsx.utils.sheet_to_json(workbook.Sheets['ECF'], { raw: false });

// Check column names containing "Advalorem" or "AdValorem" or "Recargo" or "IndicadorMonto"
const allKeys = new Set<string>();
for (const row of ecfRows) {
    Object.keys(row as any).forEach(k => allKeys.add(k));
}

console.log("=== Columns containing 'dvalorem' ===");
[...allKeys].filter(k => k.toLowerCase().includes('dvalorem')).forEach(k => console.log(k));

console.log("\n=== Columns containing 'Recargo' (first 10) ===");
[...allKeys].filter(k => k.includes('Recargo')).slice(0, 10).forEach(k => console.log(k));

console.log("\n=== Columns containing 'IndicadorMonto' ===");
[...allKeys].filter(k => k.includes('IndicadorMonto')).forEach(k => console.log(k));

console.log("\n=== Columns containing 'OtrosImpuestos' ===");
[...allKeys].filter(k => k.includes('OtrosImpuestos')).slice(0, 10).forEach(k => console.log(k));

// Check a row that has ImpuestosAdicionales to see the exact column name for AdValorem
for (const row of ecfRows) {
    const r = row as any;
    if (r['TipoImpuesto[1]'] && r['TipoImpuesto[1]'] !== '#e') {
        console.log("\n=== Sample row with ImpuestosAdicionales ===");
        console.log("eNCF:", r.eNCF);
        for (const k of Object.keys(r)) {
            if (k.includes('Impuesto') && !k.includes('#e') && r[k] !== '#e') {
                console.log(`  ${k} = ${r[k]}`);
            }
        }
        break;
    }
}

// Find rows where IndicadorMontoGravado is present and its value
console.log("\n=== IndicadorMontoGravado values per row ===");
for (const row of ecfRows) {
    const r = row as any;
    const v = r.IndicadorMontoGravado;
    console.log(`  ${r.eNCF}: IndicadorMontoGravado = '${v}'`);
}

// Check SubRecargo columns
console.log("\n=== Columns containing 'SubRecargo' (first 10) ===");
[...allKeys].filter(k => k.includes('SubRecargo')).slice(0, 10).forEach(k => console.log(k));

// Check which rows have RecargoMonto with values
console.log("\n=== Rows with RecargoMonto[1] ===");
for (const row of ecfRows) {
    const r = row as any;
    if (r['RecargoMonto[1]'] && r['RecargoMonto[1]'] !== '#e') {
        console.log(`  ${r.eNCF}: RecargoMonto[1]=${r['RecargoMonto[1]']}, SubRecargoPorcentaje[1][1]=${r['SubRecargoPorcentaje[1][1]']}, TipoSubRecargo[1][1]=${r['TipoSubRecargo[1][1]']}`);
    }
}
