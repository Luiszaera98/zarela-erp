import * as xlsx from 'xlsx';
const path = '/Users/luiszaera/Downloads/132327179-21042026125215.xlsx';
const workbook = xlsx.readFile(path);
const ecfRows = xlsx.utils.sheet_to_json(workbook.Sheets['ECF']);
console.log("Sample 1:");
console.log(JSON.stringify(ecfRows[0], null, 2));

console.log("Sample 2:");
console.log(JSON.stringify(ecfRows[1], null, 2));
