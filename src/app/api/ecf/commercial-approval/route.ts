import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    // La DGII envía una Aprobación Comercial (ACECF)
    // Para fines de certificación, simplemente aceptamos el documento
    const bodyText = await request.text();
    if (bodyText.length > 512 * 1024) {
      return NextResponse.json(
        { error: 'Payload demasiado grande' },
        { status: 413 }
      );
    }
    
    console.log('[ECF Aprobación] Recibida notificación de la DGII');
    
    // Extraer datos básicos si es posible (opcional para el log)
    const ncfMatch = bodyText.match(/<eNCF>([^<]+)<\/eNCF>/);
    const estadoMatch = bodyText.match(/<Estado>([^<]+)<\/Estado>/);

    if (ncfMatch) {
      console.log(`[ECF Aprobación] e-NCF recibido: ${ncfMatch[1]}`);
    }

    // La DGII espera un HTTP 200 para confirmar recepción de la aprobación comercial
    return new NextResponse('OK', {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  } catch (error: any) {
    console.error('[ECF Aprobación] Error:', error);
    return NextResponse.json(
      { error: 'Error procesando aprobación comercial' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'active',
    message: 'Endpoint de Aprobación Comercial listo para recibir notificaciones de la DGII.',
  });
}
