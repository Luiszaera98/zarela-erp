import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
import { ECF, Signature, Transformer, P12Reader, ENVIRONMENT, convertECF32ToRFCE } from 'dgii-ecf';
import { buildECFJson, EcfEmissor, ECFBuildOptions } from '../src/lib/ecf/ecfTransformer';

const MONGO = '' + (process.env.MONGODB_URI || 'mongodb://localhost:27017/zarela_erp') + '';
const PW = process.env.ECF_CERTIFICATE_PASSPHRASE || process.env.ECF_CERTIFICATE_PASSPHRASE || '';
const RFCE_T = 250000;
const emisor: EcfEmissor = { RNCEmisor:"132327179", RazonSocialEmisor:"INDUSTRIAS MONTERREY SRL", NombreComercial:"INDUSTRIAS MONTERREY SRL", DireccionEmisor:"MERCURIO, No. 302, SAN GERONIMO", Municipio:"010101", Provincia:"010000", TelefonoEmisor:"809-601-3269", CorreoEmisor:"VENTAS@INDUSTRIASMONTERREY.COM" };

const r = new P12Reader(PW);
const c = r.getKeyFromFile(path.resolve(__dirname,'../cert.p12'));
const sig = new Signature(c.key, c.cert);
const ecf = new ECF(c, ENVIRONMENT.CERT);
const tf = new Transformer();
const issuer = `\n<X509IssuerSerial>\n  <X509IssuerName>CN=digifirma CA Subordinada 1, OU=digifirma, O=Cámara de Comercio y Producción de Santo Domingo, L=Distrito Nacional, C=DO, 2.5.4.97=VATDO-40102368</X509IssuerName>\n  <X509SerialNumber>3135179762511420403</X509SerialNumber>\n</X509IssuerSerial>\n<X509Certificate>`;
function patch(xml:string){return xml.includes('<X509IssuerSerial>')?xml:xml.replace('<X509Certificate>',issuer);}
function sleep(ms:number){return new Promise(r=>setTimeout(r,ms));}
function secCode(xml:string){return xml.match(/<CodigoSeguridad>([^<]+)/)?.[1]||'';}
function pad(t:string,n:number){return t+String(n).padStart(10,'0');}

async function send(doc:any, ncfType:string, isExp:boolean, origInv?:any) {
  const encf = doc.encf;
  process.stdout.write(`  ${encf} `);
  const opts: ECFBuildOptions = { fechaVencimientoSecuencia:'31-12-2028' };
  if(['E33','E34'].includes(ncfType) && origInv) {
    opts.encfAfectado = origInv.encf;
    opts.fechaNCFModificado = origInv.date;
    opts.codigoModificacion = doc.codigoModificacion || (ncfType==='E34'?1:3);
    opts.razonCorreccion = doc.reason || 'Ajuste comercial';
  }
  const json = buildECFJson(doc, encf, emisor, opts);
  const xml = tf.json2xml(json);
  let sx = patch(sig.signXml(xml,'ECF'));
  const sc = secCode(sx);
  const fn = `${emisor.RNCEmisor}${encf}.xml`;
  const isRFCE = ncfType==='E32' && doc.total < RFCE_T;
  let tid:string|undefined, st='Pendiente';
  if(isRFCE){
    const d=convertECF32ToRFCE(sx); let sr=patch(sig.signXml(d.xml,'RFCE'));
    const res:any=await ecf.sendSummary(sr,fn);
    tid=res?.encf; st=res?.estado==='Aceptado'?'Aceptado':'Rechazado';
    const dir=path.resolve(__dirname,'../dgii_rfce_xmls');
    if(!fs.existsSync(dir))fs.mkdirSync(dir,{recursive:true});
    fs.writeFileSync(path.join(dir,fn),sx,'utf-8');
    console.log(`→ RFCE ${st} ${st==='Aceptado'?'✅':'❌ '+JSON.stringify(res?.mensajes)}`);
  } else {
    const res:any=await ecf.sendElectronicDocument(sx,fn);
    tid=res?.trackId; console.log(`→ ✅ Track:${tid}`);
  }
  const col = isExp?'expenses':ncfType==='E34'?'creditnotes':ncfType==='E33'?'debitnotes':'invoices';
  await mongoose.connection.db.collection(col).updateOne({_id:doc._id},{$set:{ecfStatus:st,ecfTrackId:tid,ecfSignedXml:sx,ecfFechaFirma:new Date().toISOString(),ecfCodigoSeguridad:sc}});
  return {success:true, tid};
}

async function checkAll(db:any) {
  console.log('\n── Verificando estados DGII ──');
  for(const [col,label] of [['invoices','Fact'],['debitnotes','ND'],['creditnotes','NC'],['expenses','Gas']] as const){
    const docs=await db.collection(col).find({ecfTrackId:{$exists:true,$ne:null},ecfStatus:'Pendiente'}).toArray();
    for(const d of docs){
      try{
        const r:any=await ecf.statusTrackId(d.ecfTrackId);
        const st=r?.estado==='Aceptado'||r?.estado==='AceptadoCondicional'?'Aceptado':r?.estado==='Rechazado'?'Rechazado':'Pendiente';
        const msg=r?.mensajes?.map((m:any)=>m.valor).filter(Boolean).join('; ')||'';
        await db.collection(col).updateOne({_id:d._id},{$set:{ecfStatus:st}});
        console.log(`  ${st==='Aceptado'?'✅':'❌'} ${d.encf} → ${r?.estado} ${msg}`);
      }catch(e:any){console.log(`  ⚠️ ${d.encf}: ${e.message}`);}
      await sleep(800);
    }
  }
}

async function run() {
  console.log('═══════════════════════════════════════');
  console.log('  PASO 4 COMPLETO - Limpia + Crea + Envía');
  console.log('═══════════════════════════════════════\n');
  await mongoose.connect(MONGO,{dbName:'zarela_erp'});
  const db = mongoose.connection.db;

  // 1. LIMPIAR
  for(const c of ['invoices','creditnotes','debitnotes','expenses','expensetransactions','payments','ecfauditlogs','inventorymovements'])
    await db.collection(c).deleteMany({});
  console.log('🗑️  Datos limpiados');

  // 2. AVANZAR SECUENCIAS +50
  for(const t of ['E31','E32','E33','E34','E41','E43','E44','E45','E46','E47']){
    const s=await db.collection('sequences').findOne({type:t});
    await db.collection('sequences').updateOne({type:t},{$set:{currentValue:(s?.currentValue||0)+50}});
  }
  const seqs:any={};
  const sDocs=await db.collection('sequences').find({}).toArray();
  sDocs.forEach((s:any)=>{seqs[s.type]=s.currentValue;});
  function next(t:string){seqs[t]=(seqs[t]||0)+1;return seqs[t];}
  console.log('🔢 Secuencias avanzadas +50');

  // 3. CREAR DOCUMENTOS
  const now=new Date(), due=new Date(now.getTime()+30*86400000);
  const CN='SUPLIDORA DE MARISCOS MAR Y TIERRA SRL', CR='130701601'; 
  function mkItems(l:any[]){return l.map(i=>({productName:i[0],quantity:i[1],price:i[2],discount:0,indicadorFacturacion:1,itbisRate:18}));}
  function calc(items:any[]){const s=items.reduce((a:number,i:any)=>a+i.quantity*i.price,0);const t=Math.round(s*0.18*100)/100;return{subtotal:s,tax:t,total:Math.round((s+t)*100)/100};}
  let ic=300; // Iniciar en un rango alto para pruebas
  function mkInv(nt:string,items:any[][],ov?:any){
    const sq=next(nt),ncf=pad(nt,sq),ii=mkItems(items),tt=calc(ii);
    return Object.assign({number:`FAC-2026-${String(ic++).padStart(3, '0')}`,ncf,ncfType:nt,encf:ncf,clientName:CN,clientRnc:CR,clientAddress:'N/A',date:now,dueDate:due,items:ii,subtotal:tt.subtotal,tax:tt.tax,discount:0,total:tt.total,status:'Pendiente',paidAmount:0,paymentTerms:'CONTADO',createdAt:now,updatedAt:now},ov||{});
  }

  // E31 x4
  const e31s=[
    mkInv('E31',[['Carne Res Premium',5,1000]]), // $5900
    mkInv('E31',[['Carne Cerdo Lote',5,1200]]),  // $7080
    mkInv('E31',[['Pollo Entero Lote',5,800]]),   // $4720
    mkInv('E31',[['Embutidos Mixtos',5,1500]])    // $8850
  ];
  await db.collection('invoices').insertMany(e31s);
  // E32>=250K x2
  const e32big=[mkInv('E32',[['Venta Mayorista A',1000,300]]),mkInv('E32',[['Venta Mayorista B',1200,250]])];
  await db.collection('invoices').insertMany(e32big);
  // E32<250K x4
  const e32sm=[mkInv('E32',[['Item A',5,350]]),mkInv('E32',[['Item B',4,400]]),mkInv('E32',[['Item C',6,290]]),mkInv('E32',[['Item D',3,450]])];
  await db.collection('invoices').insertMany(e32sm);
  // E44 x2, E45 x2, E46 x2
  await db.collection('invoices').insertMany([mkInv('E44',[['Esp A',10,350]]),mkInv('E44',[['Esp B',8,450]])]);
  await db.collection('invoices').insertMany([mkInv('E45',[['Gob A',20,180]]),mkInv('E45',[['Gob B',12,420]])]);
  await db.collection('invoices').insertMany([mkInv('E46',[['Exp A',50,350]]),mkInv('E46',[['Exp B',25,450]])]);

  // CARGAR LOS E31 CREADOS
  const e31Docs=await db.collection('invoices').find({ncfType:'E31'}).sort({createdAt:1}).toArray();

  // E33 x1 (ref E31 #1)
  const e33sq=next('E33'),e33n=pad('E33',e33sq),e33i=mkItems([['Ajuste',1,100]]),e33t=calc(e33i);
  await db.collection('debitnotes').insertOne({number:'ND-1',ncf:e33n,ncfType:'E33',encf:e33n,originalInvoiceId:String(e31Docs[0]._id),clientName:CN,clientRnc:CR,date:now,items:e33i,subtotal:e33t.subtotal,tax:e33t.tax,discount:0,total:e33t.total,reason:'Ajuste',codigoModificacion:3,createdAt:now,updatedAt:now});

  // E34 x2 (ref E31 #2 y #4)
  const e34Refs = [1, 3];
  for(let i=0;i<2;i++){
    const sq=next('E34'),ncf=pad('E34',sq),ref=e31Docs[e34Refs[i]];
    const price=50; 
    const ii=mkItems([['Descuento',1,price]]),tt=calc(ii);
    await db.collection('creditnotes').insertOne({number:'NC-'+(i+1),ncf,ncfType:'E34',encf:ncf,originalInvoiceId:String(ref._id),clientName:CN,clientRnc:CR,date:now,items:ii,subtotal:tt.subtotal,tax:tt.tax,discount:0,total:tt.total,reason:'Descuento comercial',codigoModificacion:3,createdAt:now,updatedAt:now});
  }

  // Gastos
  let ec=1;
  function mkExp(nt:string,desc:string,amt:number,cat:string){
    const sq=next(nt),ncf=pad(nt,sq);
    return{number:'G-'+ec++,description:desc,amount:amt,date:now,category:cat,paymentMethod:'Efectivo',supplierName:CN,supplierRnc:CR,ncf,ncfType:nt,encf:ncf,ecfStatus:'Pendiente',createdAt:now,updatedAt:now};
  }
  await db.collection('expenses').insertMany([mkExp('E41','Compra materia prima',1750,'Inventario'),mkExp('E41','Compra especias',2300,'Inventario')]);
  await db.collection('expenses').insertMany([mkExp('E43','Material empaque',850,'Operaciones'),mkExp('E43','Suministros limpieza',1200,'Operaciones')]);
  await db.collection('expenses').insertMany([mkExp('E47','Importación maquinaria',5500,'Equipos'),mkExp('E47','Consultoría internacional',3800,'Servicios')]);
  // Actualizar secuencias
  for(const[t,v] of Object.entries(seqs)) await db.collection('sequences').updateOne({type:t},{$set:{currentValue:v}});
  console.log('📦 25 documentos creados\n');

  // 4. AUTENTICAR
  await ecf.authenticate();
  console.log('🔐 Autenticado en DGII\n');

  // PRIMERO: E31, E32>=250K, E41, E43, E44, E45, E46, E47
  console.log('━━ PRIMERO: Facturas y Gastos directos ━━');
  const batch1Types = [
    {col:'invoices',type:'E31',isExp:false},
    {col:'invoices',type:'E32',isExp:false,filter:{total:{$gte:RFCE_T}}},
    {col:'expenses',type:'E41',isExp:true},
    {col:'expenses',type:'E43',isExp:true},
    {col:'invoices',type:'E44',isExp:false},
    {col:'invoices',type:'E45',isExp:false},
    {col:'invoices',type:'E46',isExp:false},
    {col:'expenses',type:'E47',isExp:true},
  ];
  for(const b of batch1Types){
    const q:any={ncfType:b.type,...(b.filter||{})};
    const docs=await db.collection(b.col).find(q).sort({createdAt:1}).toArray();
    if(!docs.length)continue;
    console.log(`\n  [${b.type}] ${docs.length} docs:`);
    for(const d of docs){await send(d,b.type,b.isExp);await sleep(2000);}
  }

  // Verificar que E31s estén Aceptados antes de enviar notas
  console.log('\n⏳ Verificando que E31s estén Aceptados...');
  for(let attempt=0;attempt<12;attempt++){
    await sleep(5000);
    let allAccepted=true;
    const e31Pending=await db.collection('invoices').find({ncfType:'E31',ecfStatus:'Pendiente'}).toArray();
    for(const d of e31Pending){
      try{
        const r:any=await ecf.statusTrackId(d.ecfTrackId);
        if(r?.estado==='Aceptado'){
          await db.collection('invoices').updateOne({_id:d._id},{$set:{ecfStatus:'Aceptado'}});
          console.log(`  ✅ ${d.encf} Aceptado`);
        } else { allAccepted=false; }
      }catch(e:any){allAccepted=false;}
    }
    if(e31Pending.length===0||allAccepted){console.log('  ✅ Todos los E31 Aceptados');break;}
    console.log(`  ⏳ Intento ${attempt+1}/12...`);
  }

  // SEGUNDO: E33, E34
  console.log('\n━━ SEGUNDO: Notas de Débito y Crédito ━━');
  const e33Docs2=await db.collection('debitnotes').find({ncfType:'E33'}).toArray();
  for(const d of e33Docs2){
    const orig=await db.collection('invoices').findOne({_id:new mongoose.Types.ObjectId(d.originalInvoiceId)});
    await send(d,'E33',false,orig);await sleep(2000);
  }
  const e34Docs2=await db.collection('creditnotes').find({ncfType:'E34'}).toArray();
  for(const d of e34Docs2){
    const orig=await db.collection('invoices').findOne({_id:new mongoose.Types.ObjectId(d.originalInvoiceId)});
    await send(d,'E34',false,orig);await sleep(3000);
  }

  // TERCERO: E32 RFCE
  console.log('\n━━ TERCERO: E32 RFCE (Resúmenes) ━━');
  const rfceDocs=await db.collection('invoices').find({ncfType:'E32',total:{$lt:RFCE_T}}).toArray();
  for(const d of rfceDocs){await send(d,'E32',false);await sleep(2000);}

  console.log('\n\n⏳ Esperando 15s antes de verificar estados...');
  await sleep(15000);

  // 5. VERIFICAR
  await checkAll(db);

  console.log('\n═══════════════════════════════════════');
  console.log('  ✅ PROCESO COMPLETO');
  console.log('═══════════════════════════════════════');
  console.log('📂 XMLs RFCE en: dgii_rfce_xmls/');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(e=>{console.error('❌',e);process.exit(1);});
