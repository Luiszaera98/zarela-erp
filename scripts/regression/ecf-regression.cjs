#!/usr/bin/env node
require('sucrase/register');

const assert = require('assert');
const { buildECFJson } = require('../../src/lib/ecf/ecfTransformer.ts');

const emisor = {
  RNCEmisor: '132327179',
  RazonSocialEmisor: 'Zarela ERP',
  DireccionEmisor: 'Zona Industrial',
  TelefonoEmisor: '8095550000',
  CorreoEmisor: 'facturacion@zarelaerp.com',
};

function buildInvoiceFixture(type, overrides = {}) {
  return {
    id: 'fixture-invoice',
    number: 'FAC-TEST-001',
    clientId: 'client-1',
    clientName: 'Cliente Demo',
    clientRnc: '101010101',
    clientAddress: 'Santo Domingo',
    date: '2026-04-23',
    dueDate: '2026-04-23',
    status: 'Pendiente',
    subtotal: 100,
    discount: 0,
    tax: 18,
    total: 118,
    paidAmount: 0,
    items: [
      {
        id: '1',
        productId: 'prod-1',
        productName: 'Producto Gravado',
        quantity: 1,
        price: 100,
        discount: 0,
        subtotal: 100,
        total: 100,
        indicadorFacturacion: 1,
      },
    ],
    ncfType: type,
    ...overrides,
  };
}

function buildExpenseFixture(type, overrides = {}) {
  return {
    id: 'fixture-expense',
    description: type === 'E47' ? 'Pago al exterior' : 'Compra materia prima',
    amount: type === 'E41' ? 118 : 100,
    date: '2026-04-23',
    category: 'Servicios',
    supplierName: 'Proveedor Demo',
    supplierRnc: '101010101',
    status: 'Pendiente',
    ncfType: type,
    ...overrides,
  };
}

function assertKeyOrder(item, earlierKey, laterKey) {
  const keys = Object.keys(item);
  assert(keys.includes(earlierKey), `Falta la clave ${earlierKey}`);
  assert(keys.includes(laterKey), `Falta la clave ${laterKey}`);
  assert(
    keys.indexOf(earlierKey) < keys.indexOf(laterKey),
    `Se esperaba ${earlierKey} antes de ${laterKey}. Orden actual: ${keys.join(', ')}`
  );
}

function run() {
  const e33Exento = buildInvoiceFixture('E33', {
    tax: 0,
    total: 100,
    items: [
      {
        id: '1',
        productId: 'prod-exento',
        productName: 'Producto Exento',
        quantity: 1,
        price: 100,
        discount: 0,
        subtotal: 100,
        total: 100,
        indicadorFacturacion: 2,
      },
    ],
  });
  const e33 = buildECFJson(
    e33Exento,
    'E330000000001',
    emisor,
    { encfAfectado: 'E310000000001', fechaNCFModificado: '2026-04-01' }
  );
  assert(!('IndicadorMontoGravado' in e33.ECF.Encabezado.IdDoc), 'E33 exento no debe incluir IndicadorMontoGravado');

  const e34Exento = buildInvoiceFixture('E34', {
    tax: 0,
    total: 100,
    items: [
      {
        id: '1',
        productId: 'prod-exento',
        productName: 'Producto Exento',
        quantity: 1,
        price: 100,
        discount: 0,
        subtotal: 100,
        total: 100,
        indicadorFacturacion: 2,
      },
    ],
  });
  const e34 = buildECFJson(
    e34Exento,
    'E340000000001',
    emisor,
    { encfAfectado: 'E310000000001', fechaNCFModificado: '2026-04-01' }
  );
  assert(!('IndicadorMontoGravado' in e34.ECF.Encabezado.IdDoc), 'E34 exento no debe incluir IndicadorMontoGravado');

  const e41 = buildECFJson(buildExpenseFixture('E41'), 'E410000000001', emisor);
  const e41Item = e41.ECF.DetallesItems.Item[0];
  assertKeyOrder(e41Item, 'Retencion', 'NombreItem');
  assert.strictEqual(e41.ECF.Encabezado.IdDoc.FechaVencimientoSecuencia, '31-12-2028');
  assert.strictEqual(e41.ECF.Encabezado.Totales.TotalITBISRetenido, '18.00');

  const e47 = buildECFJson(buildExpenseFixture('E47'), 'E470000000001', emisor);
  const e47Item = e47.ECF.DetallesItems.Item[0];
  assertKeyOrder(e47Item, 'Retencion', 'NombreItem');

  console.log('OK: regresión e-CF básica validada');
}

run();
