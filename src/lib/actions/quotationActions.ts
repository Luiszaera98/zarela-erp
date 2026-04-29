"use server";

import dbConnect from '@/lib/db';
import { Quotation as QuotationModel, Product as ProductModel } from '@/models';
import { NCFType, Quotation, QuotationStatus } from '@/types';
import { revalidatePath } from 'next/cache';
import { getAuthErrorMessage, requireRole } from '@/lib/auth/session';
import { createInvoice } from './invoiceActions';

function mapQuotation(doc: any): Quotation {
    return {
        id: doc._id.toString(),
        number: doc.number,
        clientId: doc.clientId,
        clientName: doc.clientName,
        clientRnc: doc.clientRnc,
        clientAddress: doc.clientAddress,
        date: doc.date instanceof Date ? doc.date.toISOString() : doc.date,
        validUntil: doc.validUntil instanceof Date ? doc.validUntil.toISOString() : doc.validUntil,
        status: doc.status === 'Borrador' ? 'Pendiente' : doc.status === 'Convertida' ? 'Facturada' : doc.status === 'Aprobada' ? 'Enviada' : doc.status,
        subtotal: doc.subtotal,
        discount: doc.discount,
        tax: doc.tax,
        total: doc.total,
        items: doc.items ? doc.items.map((item: any) => ({
            id: item.id || item._id?.toString(),
            productId: item.productId,
            productName: item.productName,
            description: item.description,
            itemType: item.itemType || (item.productId?.startsWith('SERVICE-') ? 'service' : 'product'),
            quantity: item.quantity,
            price: item.price,
            discount: item.discount,
            subtotal: item.subtotal,
            total: item.total,
            indicadorFacturacion: item.indicadorFacturacion,
            itbisRate: item.itbisRate,
            itbisAmount: item.itbisAmount,
        })) : [],
        notes: doc.notes,
        createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
        updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt,
    };
}

async function generateQuotationNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `COT-${year}-`;

    const quotations = await QuotationModel.find({
        number: { $regex: new RegExp(`^${prefix}`) }
    }).select('number').lean();

    let maxSequence = 0;
    for (const quotation of quotations) {
        const sequence = parseInt(quotation.number.split('-').pop() || '0', 10);
        if (!isNaN(sequence) && sequence > maxSequence) {
            maxSequence = sequence;
        }
    }

    return `${prefix}${String(maxSequence + 1).padStart(3, '0')}`;
}

export async function getQuotations(): Promise<Quotation[]> {
    await dbConnect();
    try {
        const quotations = await QuotationModel.find({}).sort({ createdAt: -1 }).lean();
        return quotations.map(mapQuotation);
    } catch (error) {
        console.error("Error fetching quotations:", error);
        return [];
    }
}

export async function getQuotationById(id: string): Promise<Quotation | null> {
    await dbConnect();
    try {
        const quotation = await QuotationModel.findById(id).lean();
        return quotation ? mapQuotation(quotation) : null;
    } catch (error) {
        console.error("Error fetching quotation by id:", error);
        return null;
    }
}

export async function createQuotation(data: {
    clientId: string;
    clientName: string;
    clientRnc?: string;
    clientAddress?: string;
    date: string;
    validUntil: string;
    items: { productId: string; productName: string; description?: string; itemType?: 'product' | 'service'; quantity: number; price: number; discount: number; }[];
    discount: number;
    tax: number;
    notes?: string;
}): Promise<{ success: boolean; quotation?: Quotation; message?: string }> {
    try {
        await requireRole(['Administrador', 'Ventas']);
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }

    await dbConnect();

    try {
        if (!data.clientId || !data.clientName) {
            return { success: false, message: "Seleccione un cliente válido" };
        }

        if (!data.items.length || data.items.some(item => !item.productId || item.quantity <= 0)) {
            return { success: false, message: "Agregue al menos un producto con una cantidad válida" };
        }

        const productIds = data.items.filter(item => item.itemType !== 'service' && !item.productId.startsWith('SERVICE-')).map(item => item.productId);
        const products = await ProductModel.find({ _id: { $in: productIds } }).lean();
        const productMap = new Map(products.map(product => [product._id.toString(), product]));

        const quotationItems = data.items.map((item, index) => {
            const product = productMap.get(item.productId);
            const subtotal = item.quantity * item.price;
            const discountAmount = (subtotal * item.discount) / 100;
            const total = subtotal - discountAmount;

            return {
                id: String(index + 1),
                productId: item.productId,
                productName: item.productName,
                description: item.itemType === 'service' || item.productId.startsWith('SERVICE-') ? item.description : product?.description,
                itemType: item.itemType === 'service' || item.productId.startsWith('SERVICE-') ? 'service' : 'product',
                quantity: item.quantity,
                price: item.price,
                discount: item.discount,
                subtotal,
                total,
            };
        });

        const itemsTotal = quotationItems.reduce((sum, item) => sum + item.total, 0);
        const generalDiscountAmount = (itemsTotal * data.discount) / 100;
        const subtotal = itemsTotal - generalDiscountAmount;
        const total = subtotal + data.tax;

        const quotation = await QuotationModel.create({
            number: await generateQuotationNumber(),
            clientId: data.clientId,
            clientName: data.clientName,
            clientRnc: data.clientRnc,
            clientAddress: data.clientAddress,
            date: new Date(data.date),
            validUntil: new Date(data.validUntil),
            subtotal,
            discount: data.discount,
            tax: data.tax,
            total,
            items: quotationItems,
            notes: data.notes,
        });

        revalidatePath('/quotations');
        return { success: true, quotation: mapQuotation(quotation) };
    } catch (error: any) {
        console.error("Error creating quotation:", error);
        return { success: false, message: error.message || "Error al crear cotización" };
    }
}

export async function updateQuotationStatus(
    id: string,
    status: QuotationStatus
): Promise<{ success: boolean; quotation?: Quotation; message?: string }> {
    try {
        await requireRole(['Administrador', 'Ventas']);
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }

    await dbConnect();
    try {
        const quotation = await QuotationModel.findByIdAndUpdate(id, { status }, { new: true }).lean();
        if (!quotation) return { success: false, message: "Cotización no encontrada" };

        revalidatePath('/quotations');
        return { success: true, quotation: mapQuotation(quotation) };
    } catch (error: any) {
        console.error("Error updating quotation status:", error);
        return { success: false, message: error.message || "Error al actualizar cotización" };
    }
}

export async function deleteQuotationAction(id: string): Promise<{ success: boolean; message?: string }> {
    try {
        await requireRole(['Administrador', 'Ventas']);
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }

    await dbConnect();
    try {
        const quotation = await QuotationModel.findById(id);
        if (!quotation) return { success: false, message: "Cotización no encontrada" };

        const status = quotation.status as string;
        if (status === 'Enviada' || status === 'Facturada' || status === 'Convertida') {
            return { success: false, message: "No se puede eliminar una cotización enviada o facturada." };
        }

        await QuotationModel.findByIdAndDelete(id);

        revalidatePath('/quotations');
        return { success: true, message: "Cotización eliminada correctamente" };
    } catch (error: any) {
        console.error("Error deleting quotation:", error);
        return { success: false, message: error.message || "Error al eliminar cotización" };
    }
}

export async function createInvoiceFromQuotation(
    quotationId: string,
    options: {
        ncfType: NCFType;
        dueDate: string;
        paymentTerms?: string;
    }
): Promise<{ success: boolean; invoiceId?: string; invoiceNumber?: string; message?: string }> {
    try {
        await requireRole(['Administrador', 'Ventas']);
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }

    await dbConnect();
    const quotation = await QuotationModel.findById(quotationId).lean();
    if (!quotation) {
        return { success: false, message: "Cotización no encontrada" };
    }

    const quotationStatus = quotation.status as string;

    if (quotationStatus === 'Facturada' || quotationStatus === 'Convertida') {
        return { success: false, message: "Esta cotización ya fue convertida a factura" };
    }

    if (quotationStatus !== 'Enviada' && quotationStatus !== 'Aprobada') {
        return { success: false, message: "Solo se puede facturar una cotización enviada" };
    }

    const result = await createInvoice({
        clientId: quotation.clientId,
        clientName: quotation.clientName,
        clientRnc: quotation.clientRnc,
        ncfType: options.ncfType,
        date: new Date().toISOString(),
        dueDate: new Date(options.dueDate).toISOString(),
        items: (quotation.items || []).map((item: any) => ({
            productId: item.productId,
            productName: item.productName,
            description: item.description,
            itemType: item.itemType,
            quantity: item.quantity,
            price: item.price,
            discount: item.discount,
        })),
        discount: quotation.discount || 0,
        tax: quotation.tax || 0,
        notes: [
            `Generada desde cotización ${quotation.number}.`,
            quotation.notes,
        ].filter(Boolean).join('\n'),
        paymentTerms: options.paymentTerms,
    });

    if (!result.success || !result.invoice) {
        return { success: false, message: result.message || "No se pudo convertir la cotización a factura" };
    }

    await QuotationModel.findByIdAndUpdate(quotationId, { status: 'Facturada' });
    revalidatePath('/quotations');
    revalidatePath('/invoices');

    return {
        success: true,
        invoiceId: result.invoice.id,
        invoiceNumber: result.invoice.number,
    };
}
