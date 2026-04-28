import * as xlsx from 'xlsx';
const path = '/Users/luiszaera/Downloads/132327179-21042026185634.xlsx';
const workbook = xlsx.readFile(path);
console.log("Sheets:", workbook.SheetNames);
for (const sheetName of workbook.SheetNames) {
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false });
    console.log(`\nSheet: ${sheetName}`);
    console.log("Columns:", Object.keys(data[0] || {}));
    console.log("First row demo:", JSON.stringify(data[0], null, 2));
}
