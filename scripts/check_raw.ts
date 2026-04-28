import * as xlsx from 'xlsx';
const path = '/Users/luiszaera/Downloads/132327179-21042026125215.xlsx';
const workbook = xlsx.readFile(path);
const ecfRows = xlsx.utils.sheet_to_json(workbook.Sheets['ECF'], { raw: false });
console.log(ecfRows[0]['MontoGravadoTotal']);
console.log(ecfRows[1]['PrecioUnitarioItem[1]']);
