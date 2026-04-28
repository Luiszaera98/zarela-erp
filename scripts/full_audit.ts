import * as xlsx from 'xlsx';
const path = '/Users/luiszaera/Downloads/132327179-21042026125215.xlsx';
const workbook = xlsx.readFile(path);
const ecfRows = xlsx.utils.sheet_to_json(workbook.Sheets['ECF'], { raw: false });

// For each row, extract ALL fields that have real (non-#e, non-empty) values
for (let i = 0; i < ecfRows.length; i++) {
    const row = ecfRows[i] as any;
    const encf = row.eNCF || row.ENCF || `ROW_${i}`;
    const realFields: Record<string, string> = {};
    
    for (const [key, val] of Object.entries(row)) {
        const v = String(val).trim();
        if (v && v !== '#e') {
            // Normalize key: strip [N] indices to get base field name
            const baseKey = key.replace(/\[\d+\]/g, '[*]');
            realFields[key] = v;
        }
    }
    
    // Print only header-level (non-item) fields for each document
    console.log(`\n========== ${encf} (Tipo ${row.TipoeCF}) ==========`);
    const headerFields: Record<string, string> = {};
    const itemFields: Record<string, string> = {};
    
    for (const [key, val] of Object.entries(realFields)) {
        if (key.match(/\[\d+\]/)) {
            itemFields[key] = val;
        } else {
            headerFields[key] = val;
        }
    }
    
    console.log("--- Header fields ---");
    for (const [k, v] of Object.entries(headerFields)) {
        console.log(`  ${k} = ${v}`);
    }
    
    // Count unique items
    const itemNums = new Set<number>();
    for (const key of Object.keys(itemFields)) {
        const m = key.match(/\[(\d+)\]/);
        if (m) itemNums.add(parseInt(m[1]));
    }
    console.log(`--- Items: ${itemNums.size} items with data ---`);
    
    // Show first item's fields as sample
    if (itemNums.size > 0) {
        const firstItem = Math.min(...itemNums);
        console.log(`  Sample item [${firstItem}]:`);
        for (const [k, v] of Object.entries(itemFields)) {
            if (k.startsWith(`NombreItem[${firstItem}]`) || 
                k.startsWith(`CantidadItem[${firstItem}]`) ||
                k.startsWith(`PrecioUnitarioItem[${firstItem}]`) ||
                k.startsWith(`MontoItem[${firstItem}]`) ||
                k.startsWith(`IndicadorFacturacion[${firstItem}]`) ||
                k.startsWith(`RecargoMonto[${firstItem}]`) ||
                k.startsWith(`TipoSubRecargo[${firstItem}]`) ||
                k.startsWith(`TipoImpuesto[${firstItem}]`) ||
                k.startsWith(`IndicadorBienoServicio[${firstItem}]`)) {
                console.log(`    ${k} = ${v}`);
            }
        }
    }
}
