/**
 * API Route: /api/ecf/receiver
 * Endpoint receptor de e-CF según el flujo Emisor→Receptor de la DGII.
 *
 * Este endpoint recibe:
 * - POST con multipart/form-data conteniendo el XML del e-CF firmado
 * - Responde con un ARECF (Acuse de Recibo del e-CF) firmado
 *
 * Flujo DGII (Informe Técnico e-CF v1.0, Sección 12):
 * 1. Emisor envía e-CF firmado al receptor
 * 2. Receptor valida y genera ARECF (este endpoint)
 * 3. Receptor envía ACECF (Aprobación Comercial) posteriormente
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { Invoice as InvoiceModel } from '@/models';
import { getECFConfig, signXML } from '@/lib/ecf/ecfService';

// ─── POST: Recibir e-CF de un emisor ──────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const config = getECFConfig();
    if (!config.isConfigured) {
      return NextResponse.json(
        { error: 'Receptor no configurado' },
        { status: 500 }
      );
    }

    // Parse the incoming multipart request
    const contentType = request.headers.get('content-type') || '';

    let xmlContent: string;
    let fileName: string = '';
    const maxPayloadSize = 2 * 1024 * 1024;

    if (contentType.includes('multipart/form-data')) {
      // Parse multipart using dgii-ecf SenderReceiver
      const { SenderReceiver } = await import('dgii-ecf');
      const senderReceiver = new SenderReceiver();

      const bodyText = await request.text();
      if (bodyText.length > maxPayloadSize) {
        return NextResponse.json(
          { error: 'Payload demasiado grande.' },
          { status: 413 }
        );
      }
      const parsed = await senderReceiver.parseMultipart(bodyText, contentType);
      xmlContent = parsed.xmlContent;
      fileName = parsed.filename;
    } else if (contentType.includes('xml') || contentType.includes('text')) {
      xmlContent = await request.text();
      if (xmlContent.length > maxPayloadSize) {
        return NextResponse.json(
          { error: 'Payload demasiado grande.' },
          { status: 413 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Content-Type no soportado. Use multipart/form-data o application/xml.' },
        { status: 400 }
      );
    }

    if (!xmlContent) {
      return NextResponse.json(
        { error: 'No se recibió contenido XML.' },
        { status: 400 }
      );
    }

    // Parse the received e-CF to extract metadata
    const { SenderReceiver, ReceivedStatus } = await import('dgii-ecf');
    const senderReceiver = new SenderReceiver();

    // Generate ARECF (Acuse de Recibo)
    // Status 0 = "e-CF Recibido" (accepted receipt)
    const arecfXml = senderReceiver.getECFDataFromXML(
      xmlContent,
      config.rncEmisor,
      ReceivedStatus['e-CF Recibido']
    );

    // Sign the ARECF
    const signedARECF = await signXML(arecfXml, 'ARECF');

    // Log the received document
    console.log(`[ECF Receptor] e-CF recibido: ${fileName || 'unknown'}`);

    // Try to extract e-NCF from the received XML for cross-reference
    const encfMatch = xmlContent.match(/<eNCF>([^<]+)<\/eNCF>/);
    const rncEmisorMatch = xmlContent.match(/<RNCEmisor>([^<]+)<\/RNCEmisor>/);
    const montoMatch = xmlContent.match(/<MontoTotal>([^<]+)<\/MontoTotal>/);

    if (encfMatch) {
      console.log(`[ECF Receptor] e-NCF recibido: ${encfMatch[1]}`);

      // Check if we have an invoice that matches this e-NCF
      // (This would be for received invoices from suppliers — future feature)
    }

    // Return signed ARECF
    return new NextResponse(signedARECF, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
      },
    });
  } catch (error: any) {
    console.error('[ECF Receptor] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Error procesando e-CF recibido' },
      { status: 500 }
    );
  }
}

// ─── GET: Verificar que el endpoint está activo ───────────────────────────────

export async function GET() {
  const config = getECFConfig();
  return NextResponse.json({
    status: 'active',
    rncReceptor: config.rncEmisor,
    environment: config.environment,
    message: 'Endpoint receptor de e-CF activo. Envíe un POST con el XML del e-CF firmado.',
  });
}
