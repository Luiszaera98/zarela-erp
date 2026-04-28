import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { Invoice as InvoiceModel, CreditNote as CreditNoteModel, DebitNote as DebitNoteModel } from '@/models';
import { verifySessionToken } from '@/lib/auth/session';

export async function GET(
  req: NextRequest,
  { searchParams }: { searchParams: URLSearchParams }
) {
  const sessionToken = req.cookies.get('session')?.value;
  const session = sessionToken ? await verifySessionToken(sessionToken) : null;
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  await dbConnect();
  
  const searchParamsObj = new URL(req.url).searchParams;
  const invoiceId = searchParamsObj.get('invoiceId');
  const type = searchParamsObj.get('type') || 'Invoice';

  if (!invoiceId) {
    return NextResponse.json({ error: 'Falta invoiceId' }, { status: 400 });
  }

  try {
    let document;
    if (type === 'Invoice') {
        document = await InvoiceModel.findById(invoiceId);
    } else if (type === 'CreditNote') {
        document = await CreditNoteModel.findById(invoiceId);
    } else if (type === 'DebitNote') {
        document = await DebitNoteModel.findById(invoiceId);
    } else {
        return NextResponse.json({ error: 'Tipo de documento no soportado para descarga' }, { status: 400 });
    }

    if (!document || !document.ecfSignedXml) {
      return NextResponse.json({ error: 'XML no encontrado para este documento' }, { status: 404 });
    }

    const fileName = `${document.encf || 'documento'}.xml`;

    return new NextResponse(document.ecfSignedXml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error('[XML Download Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
