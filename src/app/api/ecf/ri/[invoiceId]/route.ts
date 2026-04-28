/**
 * API Route: /api/ecf/ri/[invoiceId]
 * Genera y devuelve la Representación Impresa (PDF) de un e-CF.
 *
 * Query params opcionales:
 * - fechaFirma: Fecha de firma digital (dd-MM-yyyy HH:mm:ss)
 * - codigoSeguridad: 6 primeros dígitos del hash del SignatureValue
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { 
  Invoice as InvoiceModel, 
  CreditNote as CreditNoteModel, 
  DebitNote as DebitNoteModel,
  Expense as ExpenseModel
} from '@/models';
import { getECFConfig } from '@/lib/ecf/ecfService';
import {
  generateRepresentacionImpresa,
  buildRIDataFromInvoice,
} from '@/lib/ecf/ecfRepresentacionImpresa';

export async function GET(
  request: NextRequest,
  { params }: { params: { invoiceId: string } }
) {
  try {
    await dbConnect();

    const invoiceId = params.invoiceId;
    
    // Find doc in any collection
    let doc = await InvoiceModel.findById(invoiceId).lean() as any;
    let isExpense = false;

    if (!doc) doc = await CreditNoteModel.findById(invoiceId).lean() as any;
    if (!doc) doc = await DebitNoteModel.findById(invoiceId).lean() as any;
    if (!doc) {
      doc = await ExpenseModel.findById(invoiceId).lean() as any;
      if (doc) isExpense = true;
    }

    if (!doc) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
    }

    // Check it's an electronic document
    const ncfType = doc.ncfType || '';
    if (!ncfType.startsWith('E')) {
      return NextResponse.json(
        { error: 'Solo se puede generar RI para comprobantes electrónicos (e-CF).' },
        { status: 400 }
      );
    }

    if (!doc.encf) {
      return NextResponse.json(
        { error: 'El documento no tiene e-NCF asignado. Envíe el e-CF primero.' },
        { status: 400 }
      );
    }

    // Get emisor config
    const config = getECFConfig();
    if (!config.isConfigured) {
      return NextResponse.json({ error: 'Certificado e-CF no configurado.' }, { status: 500 });
    }

    // Get signature data
    const searchParams = request.nextUrl.searchParams;
    const fechaFirma = doc.ecfFechaFirma || searchParams.get('fechaFirma') || undefined;
    const codigoSeguridad = doc.ecfCodigoSeguridad || searchParams.get('codigoSeguridad') || undefined;

    // Map document to expected format
    const invoiceData: any = {
      number: isExpense ? doc.invoiceNumber || doc._id.toString().substring(0, 8) : doc.number,
      ncfType: doc.ncfType,
      encf: doc.encf,
      clientName: isExpense ? doc.supplier || 'Proveedor' : doc.clientName,
      clientRnc: isExpense ? doc.supplierRnc : doc.clientRnc,
      clientAddress: doc.clientAddress || '',
      date: doc.date,
      dueDate: doc.dueDate || doc.date,
      paymentTerms: doc.paymentTerms || 'CONTADO',
      items: [],
      subtotal: doc.subtotal || doc.amount || 0,
      discount: doc.discount || 0,
      tax: doc.tax || 0,
      total: doc.total || doc.amount || 0,
      ecfSignedXml: doc.ecfSignedXml,
    };

    if (isExpense) {
      invoiceData.items = [{
        productName: doc.description || 'Gasto General',
        quantity: 1,
        price: doc.amount || 0,
        discount: 0,
        total: doc.amount || 0,
      }];
    } else {
      invoiceData.items = (doc.items || []).map((item: any) => ({
        productName: item.productName,
        quantity: item.quantity,
        price: item.price,
        discount: item.discount || 0,
        total: item.total,
      }));
    }

    const emisor = {
      rncEmisor: config.rncEmisor,
      razonSocialEmisor: config.razonSocial,
    };

    const riData = buildRIDataFromInvoice(
      invoiceData,
      emisor,
      { fechaFirma, codigoSeguridad }
    );

    // Generate PDF
    const pdfBuffer = await generateRepresentacionImpresa(riData);

    // Return as PDF
    const fileName = `RI_${config.rncEmisor}_${doc.encf}.pdf`;
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error: any) {
    console.error('[RI API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Error generando Representación Impresa' },
      { status: 500 }
    );
  }
}
