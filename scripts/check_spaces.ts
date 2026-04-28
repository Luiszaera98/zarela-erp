import * as xlsx from 'xlsx';
const path = '/Users/luiszaera/Downloads/132327179-21042026125215.xlsx';
const workbook = xlsx.readFile(path);
const ecfRows = xlsx.utils.sheet_to_json(workbook.Sheets['ECF'], { raw: false });

// Find ALL column names with trailing/leading spaces
const allKeys = new Set<string>();
for (const row of ecfRows) {
    Object.keys(row as any).forEach(k => allKeys.add(k));
}

const badKeys: string[] = [];
for (const k of allKeys) {
    if (k !== k.trim()) {
        badKeys.push(`"${k}" → trimmed: "${k.trim()}"`);
    }
}

console.log(`Total columns: ${allKeys.size}`);
console.log(`Columns with spaces: ${badKeys.length}`);
badKeys.forEach(k => console.log(`  ${k}`));
