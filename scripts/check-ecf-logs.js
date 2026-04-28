const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function checkLogs() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  // Define Schema inline to avoid issues with absolute imports in scratch scripts
  const EcfAuditLogSchema = new mongoose.Schema({
    action: String,
    status: String,
    encf: String,
    message: String,
    requestPayload: String,
    responsePayload: String,
    createdAt: Date
  }, { collection: 'ecfauditlogs' });

  const EcfAuditLog = mongoose.models.EcfAuditLog || mongoose.model('EcfAuditLog', EcfAuditLogSchema);

  const latestLogs = await EcfAuditLog.find({})
    .sort({ createdAt: -1 })
    .limit(10);

  console.log(JSON.stringify(latestLogs, null, 2));
  await mongoose.disconnect();
}

checkLogs().catch(console.error);
