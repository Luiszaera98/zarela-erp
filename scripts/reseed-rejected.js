// Re-seed los documentos rechazados: 1x E44, 1x E45, 2x E46, 1x E34, 2x E41

function padNCF(type, num) {
  return type + String(num).padStart(10, '0');
}

const now = new Date();
const clientName = "SUPLIDORA DE MARISCOS MAR Y TIERRA SRL";
const clientRnc = "130701601";

const seqs = {};
db.sequences.find().forEach(s => { seqs[s.type] = s.currentValue; });
function nextSeq(type) {
  seqs[type] = (seqs[type] || 0) + 1;
  return seqs[type];
}

function makeItems(list) {
  return list.map(i => ({
    productName: i[0], quantity: i[1], price: i[2],
    discount: 0, indicadorFacturacion: 1, itbisRate: 18
  }));
}

function calcTotals(items) {
  const subtotal = items.reduce((s, i) => s + (i.quantity * i.price), 0);
  const tax = Math.round(subtotal * 0.18 * 100) / 100;
  return { subtotal, tax, total: Math.round((subtotal + tax) * 100) / 100 };
}

let counter = 100;
function makeInvoice(ncfType, items, overrides) {
  const seq = nextSeq(ncfType);
  const ncf = padNCF(ncfType, seq);
  const invoiceItems = makeItems(items);
  const totals = calcTotals(invoiceItems);
  return Object.assign({
    number: "FAC-R" + String(counter++),
    ncf: ncf, ncfType: ncfType, encf: ncf,
    clientName: clientName, clientRnc: clientRnc, clientAddress: "N/A",
    date: now, dueDate: new Date(now.getTime() + 30*24*60*60*1000),
    items: invoiceItems,
    subtotal: totals.subtotal, tax: totals.tax, discount: 0, total: totals.total,
    status: "Pendiente", paidAmount: 0, paymentTerms: "30 Días",
    createdAt: now, updatedAt: now
  }, overrides || {});
}

const newInvoices = [];

// 1x E44
print("Recreando 1x E44...");
newInvoices.push(makeInvoice("E44", [
  ["Tocineta Premium (Zona Franca)", 6, 320]
]));

// 1x E45
print("Recreando 1x E45...");
newInvoices.push(makeInvoice("E45", [
  ["Salami Italiano (Gobierno)", 10, 290]
]));

// 2x E46
print("Recreando 2x E46...");
newInvoices.push(makeInvoice("E46", [
  ["Chorizo Ahumado (Export)", 40, 350]
]));
newInvoices.push(makeInvoice("E46", [
  ["Jamón Serrano (Export)", 20, 450]
]));

db.invoices.insertMany(newInvoices);
print("✅ " + newInvoices.length + " facturas recreadas");

// 1x E34 - referencia al E31 que NO fue usado por la NC anterior
const e31Docs = db.invoices.find({ ncfType: "E31", ecfStatus: "Aceptado" }).sort({createdAt: 1}).toArray();
if (e31Docs.length > 0) {
  print("Recreando 1x E34...");
  const seq34 = nextSeq("E34");
  const ncf34 = padNCF("E34", seq34);
  const ref = e31Docs[e31Docs.length - 1]; // último E31 aceptado
  const cnItems = makeItems([[ref.items[0].productName + " (Devolución)", 1, ref.items[0].price]]);
  const cnTotals = calcTotals(cnItems);
  db.creditnotes.insertOne({
    number: "NC-R001", ncf: ncf34, ncfType: "E34", encf: ncf34,
    originalInvoiceId: String(ref._id),
    clientName: clientName, clientRnc: clientRnc, date: now,
    items: cnItems, subtotal: cnTotals.subtotal, tax: cnTotals.tax, discount: 0, total: cnTotals.total,
    reason: "Devolución de mercancía", codigoModificacion: 1,
    createdAt: now, updatedAt: now
  });
  print("✅ 1 NC recreada");
}

// 2x E41
print("Recreando 2x E41...");
let expC = 100;
db.expenses.insertMany([
  {
    number: "GAS-R" + expC++, description: "Compra de materia prima industrial", amount: 1750,
    date: now, category: "Inventario", paymentMethod: "Transferencia",
    supplierName: clientName, supplierRnc: clientRnc,
    ncf: padNCF("E41", nextSeq("E41")), ncfType: "E41",
    encf: padNCF("E41", seqs["E41"]), ecfStatus: "Pendiente",
    createdAt: now, updatedAt: now
  },
  {
    number: "GAS-R" + expC++, description: "Compra de especias y condimentos", amount: 2300,
    date: now, category: "Inventario", paymentMethod: "Transferencia",
    supplierName: clientName, supplierRnc: clientRnc,
    ncf: padNCF("E41", nextSeq("E41")), ncfType: "E41",
    encf: padNCF("E41", seqs["E41"]), ecfStatus: "Pendiente",
    createdAt: now, updatedAt: now
  }
]);
print("✅ 2 gastos E41 recreados");

// Actualizar secuencias
for (const [type, val] of Object.entries(seqs)) {
  db.sequences.updateOne({ type: type }, { $set: { currentValue: val } });
}

print("\nSecuencias actualizadas:");
db.sequences.find().forEach(s => print("  " + s.type + ": " + s.currentValue));
print("\n✅ Documentos recreados. Listo para reenviar.");
