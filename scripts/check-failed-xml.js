const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: '.env.local' });

const connString = process.env.MONGODB_URI;

async function run() {
  await mongoose.connect(connString);
  const Invoice = mongoose.connection.collection('invoices');
  const inv = await Invoice.findOne({ encf: 'E310000000006' });
  
  if (!inv) {
    console.log('Invoice not found');
    process.exit(1);
  }
  
  console.log('ECF Status:', inv.ecfStatus);
  console.log('XML Length:', inv.ecfSignedXml ? inv.ecfSignedXml.length : 0);
  if (inv.ecfSignedXml) {
    console.log('--- XML START ---');
    console.log(inv.ecfSignedXml);
    console.log('--- XML END ---');
  }
  
  await mongoose.disconnect();
}

run();
