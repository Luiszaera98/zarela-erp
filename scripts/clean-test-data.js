/**
 * Limpia todos los datos de prueba del ERP sin tocar las secuencias NCF.
 * Uso: node scripts/clean-test-data.js
 */
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;

async function cleanTestData() {
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI no encontrada en .env.local');
    process.exit(1);
  }

  console.log('Conectando a MongoDB...');
  await mongoose.connect(MONGODB_URI, {
    dbName: 'zarela_erp',
    bufferCommands: false,
  });
  console.log('✅ Conectado.\n');

  const db = mongoose.connection.db;

  // Colecciones a limpiar (NO incluye 'sequences')
  const collections = [
    'invoices',
    'creditnotes',
    'debitnotes',
    'expenses',
    'expensetransactions',
    'payments',
    'ecfauditlogs',
    'inventorymovements',
  ];

  for (const name of collections) {
    try {
      const col = db.collection(name);
      const count = await col.countDocuments();
      if (count > 0) {
        await col.deleteMany({});
        console.log(`🗑️  ${name}: ${count} documentos eliminados`);
      } else {
        console.log(`   ${name}: vacía (0 documentos)`);
      }
    } catch (e) {
      console.log(`   ${name}: no existe o error (${e.message})`);
    }
  }

  // Verificar secuencias intactas
  try {
    const seqs = await db.collection('sequences').find({}).toArray();
    console.log('\n🔒 Secuencias NCF preservadas:');
    for (const seq of seqs) {
      console.log(`   ${seq.type}: ${seq.currentValue}`);
    }
  } catch (e) {
    console.log('\n⚠️  No se encontró colección de secuencias.');
  }

  console.log('\n✅ Limpieza completada. Las secuencias NCF están intactas.');
  await mongoose.disconnect();
  process.exit(0);
}

cleanTestData().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
