// Script para crear todos los documentos necesarios para el Paso 4 de certificación DGII
// Se ejecuta dentro de mongosh

function padNCF(type, num) {
  return type + String(num).padStart(10, '0');
}

const now = new Date();
const dueDate = new Date(now.getTime() + 30*24*60*60*1000);
const clientName = "SUPLIDORA DE MARISCOS MAR Y TIERRA SRL";
const clientRnc = "130701601";

// ── Obtener secuencias actuales ──
const seqs = {};
db.sequences.find().forEach(s => { seqs[s.type] = s.currentValue; });
function nextSeq(type) {
  seqs[type] = (seqs[type] || 0) + 1;
  return seqs[type];
}

// Helper: crear items de factura
function makeItems(list) {
  return list.map(i => ({
    productName: i[0],
    quantity: i[1],
    price: i[2],
    discount: 0,
    indicadorFacturacion: 1,
    itbisRate: 18
  }));
}

function calcTotals(items) {
  const subtotal = items.reduce((s, i) => s + (i.quantity * i.price), 0);
  const tax = Math.round(subtotal * 0.18 * 100) / 100;
  return { subtotal, tax, discount: 0, total: Math.round((subtotal + tax) * 100) / 100 };
}

// ── Helper: crear factura ──
let invCounter = 1;
function makeInvoice(ncfType, items, overrides) {
  const seq = nextSeq(ncfType);
  const ncf = padNCF(ncfType, seq);
  const invoiceItems = makeItems(items);
  const totals = calcTotals(invoiceItems);
  const num = "FAC-" + String(invCounter++).padStart(4, '0');
  return Object.assign({
    number: num,
    ncf: ncf,
    ncfType: ncfType,
    encf: ncf,
    clientName: clientName,
    clientRnc: clientRnc,
    clientAddress: "N/A",
    date: now,
    dueDate: dueDate,
    items: invoiceItems,
    subtotal: totals.subtotal,
    tax: totals.tax,
    discount: 0,
    total: totals.total,
    status: "Pendiente",
    paidAmount: 0,
    paymentTerms: "30 Días",
    createdAt: now,
    updatedAt: now
  }, overrides || {});
}

// ══════════════════════════════════════════════════════════════════
// FACTURAS (invoices collection)
// ══════════════════════════════════════════════════════════════════

const allInvoices = [];

// ── E31: 4 Facturas de Crédito Fiscal ──
print("Creando 4x E31...");
allInvoices.push(makeInvoice("E31", [
  ["Chorizo Ahumado", 5, 350],
  ["Salchichón de Res", 3, 280]
]));
allInvoices.push(makeInvoice("E31", [
  ["Jamón Serrano", 4, 450],
  ["Carne Molida Premium", 8, 250],
  ["Tocineta Premium", 2, 320]
]));
allInvoices.push(makeInvoice("E31", [
  ["Pechuga de Pollo", 10, 180]
]));
allInvoices.push(makeInvoice("E31", [
  ["Costillas BBQ", 6, 420],
  ["Salami Italiano", 4, 290]
]));

// ── E32 >= 250K: 2 Facturas de Consumo grandes ──
print("Creando 2x E32 >= 250K...");
allInvoices.push(makeInvoice("E32", [
  ["Chorizo Ahumado (Lote Industrial)", 1000, 300]
]));
allInvoices.push(makeInvoice("E32", [
  ["Salchichón de Res (Lote Industrial)", 1200, 250]
]));

// ── E32 < 250K: 4 Facturas de Consumo RFCE ──
print("Creando 4x E32 < 250K (RFCE)...");
allInvoices.push(makeInvoice("E32", [
  ["Chorizo Ahumado", 3, 350],
  ["Pechuga de Pollo", 2, 180]
]));
allInvoices.push(makeInvoice("E32", [
  ["Costillas BBQ", 2, 420],
  ["Tocineta Premium", 1, 320]
]));
allInvoices.push(makeInvoice("E32", [
  ["Salami Italiano", 4, 290]
]));
allInvoices.push(makeInvoice("E32", [
  ["Jamón Serrano", 2, 450],
  ["Carne Molida Premium", 3, 250]
]));

// ── E44: 2 Regímenes Especiales ──
print("Creando 2x E44...");
allInvoices.push(makeInvoice("E44", [
  ["Chorizo Ahumado (Zona Franca)", 10, 350],
  ["Salchichón de Res", 5, 280]
]));
allInvoices.push(makeInvoice("E44", [
  ["Jamón Serrano (Zona Franca)", 8, 450]
]));

// ── E45: 2 Gubernamental ──
print("Creando 2x E45...");
allInvoices.push(makeInvoice("E45", [
  ["Pechuga de Pollo", 20, 180],
  ["Carne Molida Premium", 15, 250]
]));
allInvoices.push(makeInvoice("E45", [
  ["Costillas BBQ", 12, 420],
  ["Tocineta Premium", 8, 320]
]));

// ── E46: 2 Exportaciones ──
print("Creando 2x E46...");
allInvoices.push(makeInvoice("E46", [
  ["Chorizo Ahumado (Export)", 50, 350],
  ["Salami Italiano (Export)", 30, 290]
]));
allInvoices.push(makeInvoice("E46", [
  ["Jamón Serrano (Export)", 25, 450]
]));

// Insertar todas las facturas
const insertedInvoices = db.invoices.insertMany(allInvoices);
print("✅ " + allInvoices.length + " facturas creadas");

// Obtener IDs de las E31 para las notas
const e31Docs = db.invoices.find({ ncfType: "E31" }).sort({ createdAt: 1 }).toArray();

// ══════════════════════════════════════════════════════════════════
// NOTAS DE DÉBITO (debitnotes collection) - E33
// ══════════════════════════════════════════════════════════════════
print("Creando 1x E33 (Nota de Débito)...");
const e33Seq = nextSeq("E33");
const e33Ncf = padNCF("E33", e33Seq);
const e33Items = makeItems([["Ajuste precio Chorizo Ahumado", 2, 50]]);
const e33Totals = calcTotals(e33Items);
db.debitnotes.insertOne({
  number: "ND-0001",
  ncf: e33Ncf,
  ncfType: "E33",
  encf: e33Ncf,
  originalInvoiceId: String(e31Docs[0]._id),
  clientName: clientName,
  clientRnc: clientRnc,
  date: now,
  items: e33Items,
  subtotal: e33Totals.subtotal,
  tax: e33Totals.tax,
  discount: 0,
  total: e33Totals.total,
  reason: "Ajuste de precio por acuerdo comercial",
  codigoModificacion: 3,
  createdAt: now,
  updatedAt: now
});
print("✅ 1 nota de débito creada");

// ══════════════════════════════════════════════════════════════════
// NOTAS DE CRÉDITO (creditnotes collection) - E34
// ══════════════════════════════════════════════════════════════════
print("Creando 2x E34 (Notas de Crédito)...");
for (let i = 0; i < 2; i++) {
  const seq34 = nextSeq("E34");
  const ncf34 = padNCF("E34", seq34);
  const ref = e31Docs[i + 1]; // referencia E31 #2 y #3
  const cnItems = makeItems([
    [ref.items[0].productName + " (Devolución)", 1, ref.items[0].price]
  ]);
  const cnTotals = calcTotals(cnItems);
  db.creditnotes.insertOne({
    number: "NC-" + String(i + 1).padStart(4, '0'),
    ncf: ncf34,
    ncfType: "E34",
    encf: ncf34,
    originalInvoiceId: String(ref._id),
    clientName: clientName,
    clientRnc: clientRnc,
    date: now,
    items: cnItems,
    subtotal: cnTotals.subtotal,
    tax: cnTotals.tax,
    discount: 0,
    total: cnTotals.total,
    reason: i === 0 ? "Devolución de mercancía en mal estado" : "Error en facturación",
    codigoModificacion: i === 0 ? 1 : 3,
    createdAt: now,
    updatedAt: now
  });
}
print("✅ 2 notas de crédito creadas");

// ══════════════════════════════════════════════════════════════════
// GASTOS (expenses collection) - E41, E43, E47
// ══════════════════════════════════════════════════════════════════
let expCounter = 1;
function makeExpense(ncfType, desc, amount, category, overrides) {
  const seq = nextSeq(ncfType);
  const ncf = padNCF(ncfType, seq);
  return Object.assign({
    number: "GAS-" + String(expCounter++).padStart(4, '0'),
    description: desc,
    amount: amount,
    date: now,
    category: category,
    paymentMethod: "Transferencia",
    supplierName: clientName,
    supplierRnc: clientRnc,
    ncf: ncf,
    ncfType: ncfType,
    encf: ncf,
    ecfStatus: "Pendiente",
    createdAt: now,
    updatedAt: now
  }, overrides || {});
}

print("Creando 2x E41 (Compras)...");
db.expenses.insertMany([
  makeExpense("E41", "Compra de materia prima - Carne de res", 1750, "Inventario"),
  makeExpense("E41", "Compra de especias y condimentos", 2300, "Inventario"),
]);

print("Creando 2x E43 (Gastos Menores)...");
db.expenses.insertMany([
  makeExpense("E43", "Material de empaque y etiquetas", 850, "Operaciones"),
  makeExpense("E43", "Suministros de limpieza industrial", 1200, "Operaciones"),
]);

print("Creando 2x E47 (Pagos al Exterior)...");
db.expenses.insertMany([
  makeExpense("E47", "Importación de maquinaria de empaque", 5500, "Equipos"),
  makeExpense("E47", "Servicio de consultoría internacional", 3800, "Servicios"),
]);
print("✅ 6 gastos creados");

// ══════════════════════════════════════════════════════════════════
// ACTUALIZAR SECUENCIAS
// ══════════════════════════════════════════════════════════════════
print("\nActualizando secuencias...");
for (const [type, val] of Object.entries(seqs)) {
  db.sequences.updateOne({ type: type }, { $set: { currentValue: val } });
}

print("\n═══════════════════════════════════════");
print("RESUMEN DE DOCUMENTOS CREADOS:");
print("═══════════════════════════════════════");
print("  E31 (Factura Crédito Fiscal): 4");
print("  E32 >= 250K (Consumo):        2");
print("  E32 < 250K (RFCE):            4");
print("  E33 (Nota de Débito):         1");
print("  E34 (Nota de Crédito):        2");
print("  E44 (Regímenes Especiales):   2");
print("  E45 (Gubernamental):          2");
print("  E46 (Exportaciones):          2");
print("  E41 (Compras):                2");
print("  E43 (Gastos Menores):         2");
print("  E47 (Pagos al Exterior):      2");
print("  TOTAL:                       25");
print("\nSecuencias actualizadas:");
db.sequences.find().forEach(s => print("  " + s.type + ": " + s.currentValue));
print("\n✅ ¡Listo! Recarga el ERP y envía los documentos.");
