const { P12Reader, Signature } = require('dgii-ecf');
const fs = require('fs');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: '.env.local' });

async function signFile() {
    const filePath = process.argv[2];
    if (!filePath) {
        console.error("❌ Error: Debes proporcionar la ruta del archivo XML.");
        process.exit(1);
    }

    try {
        const absolutePath = path.resolve(filePath);
        const xmlContent = fs.readFileSync(absolutePath, 'utf8');

        console.log("⏳ Leyendo certificado...");
        const reader = new P12Reader(process.env.ECF_CERTIFICATE_PASSPHRASE);
        const certs = reader.getKeyFromStringBase64(process.env.ECF_CERTIFICATE_BASE64);

        if (!certs || !certs.key || !certs.cert) {
            throw new Error("No se pudo leer el certificado del .env.local");
        }

        console.log("⏳ Firmando Declaración Jurada...");
        // La Declaración Jurada de la DGII suele tener el tag raíz 'DeclaracionJurada' o similar
        // Intentamos detectar el tag raíz automáticamente
        const rootTagMatch = xmlContent.match(/<([a-zA-Z0-9]+)[^>]*>/);
        const rootTag = rootTagMatch ? rootTagMatch[1] : 'DeclaracionJurada';
        
        console.log(`🎯 Usando tag raíz: ${rootTag}`);

        const signature = new Signature(certs.key, certs.cert);
        const signedXml = signature.signXml(xmlContent, rootTag);

        // Guardar archivo firmado
        const dir = path.dirname(absolutePath);
        const ext = path.extname(absolutePath);
        const name = path.basename(absolutePath, ext);
        const outputPath = path.join(dir, `${name}_SIGNED${ext}`);

        fs.writeFileSync(outputPath, signedXml, 'utf8');
        console.log(`✅ ¡ÉXITO! Archivo firmado guardado en:`);
        console.log(`➡️  ${outputPath}`);

    } catch (e) {
        console.error("❌ Error al firmar:");
        console.error(e.message || e);
    }
}

signFile();
