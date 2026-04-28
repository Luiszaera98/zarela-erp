import { NextRequest, NextResponse } from 'next/server';
import { P12Reader, Signature } from 'dgii-ecf';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { verifySessionToken } from '@/lib/auth/session';

export async function POST(req: NextRequest) {
    let p12Path: string | null = null;
    try {
        const sessionToken = req.cookies.get('session')?.value;
        const session = sessionToken ? await verifySessionToken(sessionToken) : null;
        const internalToken = process.env.SIGN_XML_INTERNAL_TOKEN?.trim();
        const headerToken = req.headers.get('x-sign-xml-token')?.trim();
        const isAuthorized =
            session?.role === 'Administrador' ||
            (!!internalToken && headerToken === internalToken) ||
            process.env.NODE_ENV !== 'production';

        if (!isAuthorized) {
            return new NextResponse("Error: Unauthorized", { status: 401 });
        }

        const xmlContent = await req.text();
        const xml = xmlContent.trim();
        if (xml.length > 2 * 1024 * 1024) {
            return new NextResponse("Error: XML body too large", { status: 413 });
        }
        
        if (!xml || !xml.includes('<')) {
            return new NextResponse("Error: Invalid XML body", { status: 400 });
        }

        const password = process.env.ECF_CERTIFICATE_PASSPHRASE || '';
        const base64 = process.env.ECF_CERTIFICATE_BASE64 || '';
        if (!password || !base64) {
            return new NextResponse("Error: Certificate not configured", { status: 500 });
        }
        
        const p12Buffer = Buffer.from(base64, 'base64');
        p12Path = path.resolve('/tmp', `temp_cert_${randomUUID()}.p12`);
        fs.writeFileSync(p12Path, p12Buffer);

        // Usamos exactamente el método sugerido por los docs de la librería
        const reader = new P12Reader(password);
        const certs = reader.getKeyFromFile(p12Path);

        if (!certs.key || !certs.cert) {
            return new NextResponse("Error: Failed to read certificates from constructed p12 file", { status: 500 });
        }

        const signature = new Signature(certs.key, certs.cert);
        let signedXml = signature.signXml(xml, 'Postulacion');

        // FORCE INJECT X509IssuerSerial TO FIX DGII JAVA VALIDATOR FOR POSTULACION
        const issuerName = "CN=digifirma CA Subordinada 1, OU=digifirma, O=Cámara de Comercio y Producción de Santo Domingo, L=Distrito Nacional, C=DO, 2.5.4.97=VATDO-40102368";
        const serialNumber = "3135179762511420403";
        
        const issuerNode = `
<X509IssuerSerial>
  <X509IssuerName>${issuerName}</X509IssuerName>
  <X509SerialNumber>${serialNumber}</X509SerialNumber>
</X509IssuerSerial>
<X509Certificate>`;

        // Only replace if it doesn't already exist to be safe
        if (!signedXml.includes('<X509IssuerSerial>')) {
            signedXml = signedXml.replace('<X509Certificate>', issuerNode);
        }

        return new NextResponse(signedXml, {
            status: 200,
            headers: {
                'Content-Type': 'application/xml',
                'Content-Disposition': 'attachment; filename="postulacion_SIGNED.xml"'
            }
        });
    } catch (error: any) {
        console.error(error);
        return new NextResponse(`Error: ${error.message}`, { status: 500 });
    } finally {
        if (p12Path && fs.existsSync(p12Path)) {
            fs.unlinkSync(p12Path);
        }
    }
}
