import * as xlsx from 'xlsx';
const path = '/Users/luiszaera/Downloads/132327179-21042026125215.xlsx';
const workbook = xlsx.readFile(path);
const ecfRows = xlsx.utils.sheet_to_json(workbook.Sheets['ECF'], { raw: false });

function normalizeRow(row: any): any {
    const n: any = {};
    for (const [k, v] of Object.entries(row)) n[k.trim()] = v;
    return n;
}

const docs = ecfRows.map(normalizeRow);

for (const doc of docs) {
    if (doc.eNCF === 'E320000000006' || doc.ENCF === 'E320000000006') {
        console.log(`Document E320000000006 details:`);
        console.log(`- TipoeCF: ${doc.TipoeCF}`);
        console.log(`- MontoTotal: ${doc.MontoTotal}`);
    }
}
