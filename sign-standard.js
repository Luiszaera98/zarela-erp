const { SignedXml } = require('xml-crypto');
const fs = require('fs');
const forge = require('node-forge');

function getPemFromP12(p12Path, password) {
    const p12Der = fs.readFileSync(p12Path, 'binary');
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

    let privateKey, cert;
    for (const safeContents of p12.safeContents) {
        for (const safeBag of safeContents.safeBags) {
            if (safeBag.type === forge.pki.oids.keyBag || safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag) {
                privateKey = safeBag.key;
            } else if (safeBag.type === forge.pki.oids.certBag) {
                cert = safeBag.cert;
            }
        }
    }
    
    return {
        key: forge.pki.privateKeyToPem(privateKey),
        cert: forge.pki.certificateToPem(cert)
    };
}

function signStandard(xmlPath, p12Path, password) {
    const xml = fs.readFileSync(xmlPath, 'utf8');
    const { key, cert } = getPemFromP12(p12Path, password);
    
    // Clean cert string for KeyInfo
    const cleanCert = cert.replace(/-----BEGIN CERTIFICATE-----/g, '')
                          .replace(/-----END CERTIFICATE-----/g, '')
                          .replace(/\r/g, '').replace(/\n/g, '');

    const sig = new SignedXml();
    sig.addReference(
        "/*",
        ["http://www.w3.org/2000/09/xmldsig#enveloped-signature"],
        "http://www.w3.org/2001/04/xmlenc#sha256"
    );
    sig.signatureAlgorithm = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";
    sig.keyInfoProvider = {
        getKeyInfo: () => `<X509Data><X509Certificate>${cleanCert}</X509Certificate></X509Data>`,
        getKey: () => key
    };
    
    sig.signingKey = key;
    sig.computeSignature(xml);
    
    // Replace standalone tags to avoid messing up closing tags
    let signedXml = sig.getSignedXml();
    fs.writeFileSync(xmlPath.replace('.xml', '_STD_FIRMADO.xml'), signedXml);
    console.log("Signed with standard xml-crypto to", xmlPath.replace('.xml', '_STD_FIRMADO.xml'));
}

// Usage: node sign-standard.js <xmlPath> <p12Path> <password>
// Or set ECF_CERTIFICATE_PASSPHRASE in .env.local
const args = process.argv.slice(2);
if (args.length < 2) {
    console.error('Usage: node sign-standard.js <xmlPath> <p12Path> [password]');
    process.exit(1);
}
const password = args[2] || process.env.ECF_CERTIFICATE_PASSPHRASE || '';
signStandard(args[0], args[1], password);
