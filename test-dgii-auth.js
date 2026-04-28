const { ECF } = require('dgii-ecf');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

async function testAuth() {
    try {
        console.log("Configurando ECF con el .p12...");
        const ecf = new ECF({
            certificate: Buffer.from(process.env.ECF_CERTIFICATE_BASE64, 'base64'),
            password: process.env.ECF_CERTIFICATE_PASSPHRASE,
            environment: 'test' // TesteCF
        });

        console.log("Autenticando con DGII...");
        const token = await ecf.authenticate();
        console.log("✅ Autenticación exitosa! Token (cortado):", token.substring(0, 50) + "...");
    } catch (e) {
        console.error("❌ Error de autenticación:", e);
    }
}
testAuth();
