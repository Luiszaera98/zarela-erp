import mongoose from 'mongoose';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { ECF, P12Reader, ENVIRONMENT } from 'dgii-ecf';

const MONGODB_URI = '' + (process.env.MONGODB_URI || 'mongodb://localhost:27017/zarela_erp') + '';
const PASSWORD = process.env.ECF_CERTIFICATE_PASSPHRASE || process.env.ECF_CERTIFICATE_PASSPHRASE || '';

const p12Path = path.resolve(__dirname, '../cert.p12');
const reader = new P12Reader(PASSWORD);
const certs = reader.getKeyFromFile(p12Path);
const ecfApi = new ECF(certs, ENVIRONMENT.CERT);

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  await mongoose.connect(MONGODB_URI, { dbName: 'zarela_erp' });
  const db = mongoose.connection.db;

  await ecfApi.authenticate();
  console.log("✅ Autenticado\n");

  const collections = [
    { name: 'invoices', label: 'Facturas' },
    { name: 'debitnotes', label: 'Notas Débito' },
    { name: 'creditnotes', label: 'Notas Crédito' },
    { name: 'expenses', label: 'Gastos' },
  ];

  for (const col of collections) {
    const docs = await db.collection(col.name).find({
      ecfTrackId: { $exists: true, $ne: null },
      ecfStatus: 'Pendiente'
    }).toArray();

    if (docs.length === 0) continue;
    console.log(`── ${col.label} (${docs.length} pendientes) ──`);

    for (const doc of docs) {
      const trackId = doc.ecfTrackId;
      const encf = doc.encf;
      try {
        const res: any = await ecfApi.statusTrackId(trackId);
        const estado = res?.estado || 'Desconocido';
        const mensajes = res?.mensajes?.map((m: any) => m.valor).filter((v: string) => v).join('; ') || '';
        
        const newStatus = estado === 'Aceptado' ? 'Aceptado' 
          : estado === 'AceptadoCondicional' ? 'Aceptado'
          : estado === 'Rechazado' ? 'Rechazado'
          : 'Pendiente';
        
        await db.collection(col.name).updateOne(
          { _id: doc._id },
          { $set: { ecfStatus: newStatus } }
        );

        const icon = newStatus === 'Aceptado' ? '✅' : newStatus === 'Rechazado' ? '❌' : '⏳';
        console.log(`  ${icon} ${encf} → ${estado} ${mensajes ? '| ' + mensajes : ''}`);
      } catch (err: any) {
        console.log(`  ⚠️  ${encf} → Error: ${err.message}`);
      }
      await sleep(1000);
    }
    console.log('');
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
