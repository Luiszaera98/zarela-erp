import * as xlsx from 'xlsx';

const path = '/Users/luiszaera/Downloads/132327179-21042026125215.xlsx';
const workbook = xlsx.readFile(path);
const sheet = workbook.Sheets[workbook.SheetNames[0]];

const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
console.log(JSON.stringify(data[4], null, 2));
