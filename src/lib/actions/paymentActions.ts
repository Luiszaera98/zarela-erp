"use server";

import dbConnect from '@/lib/db';
import { runTransaction } from '@/lib/db';
import { Payment as PaymentModel, CreditNote as CreditNoteModel, DebitNote as DebitNoteModel, Invoice as InvoiceModel } from '@/models';
import { Payment, CreditNote } from '@/types';
import { revalidatePath } from 'next/cache';
import { updateInvoicePaymentStatus, fixInvoiceBalances } from './invoiceActions';
import { getAuthErrorMessage, requireRole } from '@/lib/auth/session';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { getNextNCF, getNextENCF } from './settingsActions';
import mongoose from 'mongoose';
import { bulkUpdateStock, StockItem } from '@/lib/inventoryUtils';

type NoteInputItem = {
    productId: string;
    productName: string;
    description?: string;
    itemType?: 'product' | 'service';
    quantity: number;
    price: number;
    discount: number;
};

function isServiceItem(item: { itemType?: string; productId?: string }) {
    return item.itemType === 'service' || item.productId?.startsWith('SERVICE-');
}

function toStockItems(items: { productId: string; productName?: string; quantity: number; itemType?: string }[]): StockItem[] {
    return items
        .filter(item => !isServiceItem(item) && mongoose.Types.ObjectId.isValid(item.productId))
        .map(item => ({
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity
        }));
}

function getInvoiceStatusAfterBalanceChange(invoice: { total: number; paidAmount?: number; creditNotes?: unknown[] }) {
    const paidAmount = invoice.paidAmount || 0;

    if (paidAmount >= invoice.total - 0.01) {
        return 'Pagada';
    }

    if (paidAmount > 0) {
        return invoice.creditNotes && invoice.creditNotes.length > 0 ? 'Nota de Crédito Parcial' : 'Parcial';
    }

    return 'Pendiente';
}

function hasDgiiSubmission(doc: { ecfTrackId?: string; ecfSignedXml?: string }) {
    return Boolean(doc.ecfTrackId || doc.ecfSignedXml);
}

// Helper to convert MongoDB document to Payment type
function mapPayment(doc: any): Payment {
    return {
        id: doc._id.toString(),
        invoiceId: doc.invoiceId,
        invoiceNumber: doc.invoiceNumber,
        amount: doc.amount,
        paymentMethod: doc.paymentMethod,
        paymentDate: doc.paymentDate.toISOString(),
        reference: doc.reference,
        notes: doc.notes,
        createdBy: doc.createdBy,
        createdAt: doc.createdAt.toISOString()
    };
}

// Helper to convert MongoDB document to CreditNote type
function mapCreditNote(doc: any): CreditNote {
    return {
        id: doc._id.toString(),
        number: doc.number,
        ncf: doc.ncf,
        ncfType: doc.ncfType,
        originalInvoiceId: doc.originalInvoiceId,
        originalInvoiceNumber: doc.originalInvoiceNumber,
        originalInvoiceNcf: doc.originalInvoiceNcf,
        clientId: doc.clientId,
        clientName: doc.clientName,
        clientRnc: doc.clientRnc,
        date: doc.date.toISOString(),
        reason: doc.reason,
        codigoModificacion: doc.codigoModificacion,
        subtotal: doc.subtotal,
        discount: doc.discount,
        tax: doc.tax,
        total: doc.total,
        items: (doc.items || []).map((item: any) => ({ ...item, id: item.id || item._id?.toString() })),
        notes: doc.notes,
        encf: doc.encf,
        ecfStatus: doc.ecfStatus,
        ecfTrackId: doc.ecfTrackId,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString()
    };
}

// Helper to convert MongoDB document to DebitNote type
function mapDebitNote(doc: any): any {
    return {
        id: doc._id.toString(),
        number: doc.number,
        ncf: doc.ncf,
        ncfType: doc.ncfType,
        originalInvoiceId: doc.originalInvoiceId,
        originalInvoiceNumber: doc.originalInvoiceNumber,
        originalInvoiceNcf: doc.originalInvoiceNcf,
        clientId: doc.clientId,
        clientName: doc.clientName,
        clientRnc: doc.clientRnc,
        date: doc.date.toISOString(),
        reason: doc.reason,
        codigoModificacion: doc.codigoModificacion,
        subtotal: doc.subtotal,
        discount: doc.discount,
        tax: doc.tax,
        total: doc.total,
        items: (doc.items || []).map((item: any) => ({ ...item, id: item.id || item._id?.toString() })),
        notes: doc.notes,
        encf: doc.encf,
        ecfStatus: doc.ecfStatus,
        ecfTrackId: doc.ecfTrackId,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString()
    };
}

// ============= PAYMENTS =============

export async function createPayment(data: {
    invoiceId: string;
    invoiceNumber: string;
    amount: number;
    paymentMethod: string;
    paymentDate: string;
    reference?: string;
    notes?: string;
    createdBy: string;
}): Promise<{ success: boolean; payment?: Payment; message?: string }> {
    try {
        await requireRole(['Administrador', 'Ventas']);
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }
    await dbConnect();
    try {
        const invoice = await InvoiceModel.findById(data.invoiceId);

        if (!invoice) {
            return { success: false, message: "Factura no encontrada" };
        }

        if (invoice.status === 'Anulada') {
            return { success: false, message: "No se pueden registrar pagos a facturas anuladas" };
        }

        const remainingBalance = invoice.total - invoice.paidAmount;

        if (data.amount <= 0) {
            return { success: false, message: "El monto del pago debe ser mayor a cero" };
        }

        // Allow small floating point differences
        if (data.amount > remainingBalance + 0.01) {
            return { success: false, message: `El monto excede el saldo pendiente (${remainingBalance.toLocaleString('es-DO', { style: 'currency', currency: 'DOP' })})` };
        }

        const newPayment = await PaymentModel.create({
            invoiceId: data.invoiceId,
            invoiceNumber: data.invoiceNumber,
            amount: data.amount,
            paymentMethod: data.paymentMethod,
            paymentDate: data.paymentDate,
            reference: data.reference,
            notes: data.notes,
            createdBy: data.createdBy
        });

        // Update invoice paid amount and status
        await updateInvoicePaymentStatus(data.invoiceId, newPayment._id.toString());

        revalidatePath('/invoices');
        revalidatePath('/payments');

        return { success: true, payment: mapPayment(newPayment) };
    } catch (error: any) {
        console.error('Error creating payment:', error);
        return { success: false, message: error.message || "Error al registrar el pago" };
    }
}

export async function getPaymentsByInvoice(invoiceId: string): Promise<Payment[]> {
    await dbConnect();
    try {
        const payments = await PaymentModel.find({ invoiceId }).sort({ paymentDate: -1 }).lean();
        return payments.map(mapPayment);
    } catch (error) {
        console.error("Error fetching payments:", error);
        return [];
    }
}

export async function getAllPayments(month?: string, year?: string, timezoneOffset?: number): Promise<Payment[]> {
    await dbConnect();
    try {
        let query: any = {};
        if (month && year) {
            const offsetMs = (timezoneOffset || 0) * 60 * 1000;
            const startUTC = Date.UTC(parseInt(year), parseInt(month), 1);
            const startDate = new Date(startUTC + offsetMs);
            const endUTC = Date.UTC(parseInt(year), parseInt(month) + 1, 0, 23, 59, 59, 999);
            const endDate = new Date(endUTC + offsetMs);
            query.paymentDate = { $gte: startDate, $lte: endDate };
        }

        const payments = await PaymentModel.find(query).sort({ paymentDate: -1 }).lean();
        return payments.map(mapPayment);
    } catch (error) {
        console.error("Error fetching all payments:", error);
        return [];
    }
}

export async function deletePayment(paymentId: string): Promise<{ success: boolean; message?: string }> {
    try {
        await requireRole(['Administrador', 'Ventas']);
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }
    await dbConnect();
    try {
        const payment = await PaymentModel.findById(paymentId);

        if (!payment) {
            return { success: false, message: "Pago no encontrado" };
        }

        // Update invoice first
        await updateInvoicePaymentStatus(payment.invoiceId, paymentId, true); // true = remove payment

        // Then delete payment
        await PaymentModel.findByIdAndDelete(paymentId);

        revalidatePath('/invoices');
        revalidatePath('/payments');

        return { success: true, message: "Pago eliminado correctamente" };
    } catch (error: any) {
        console.error('Error deleting payment:', error);
        return { success: false, message: error.message || "Error al eliminar el pago" };
    }
}

export async function updatePayment(id: string, data: {
    amount?: number;
    paymentMethod?: string;
    paymentDate?: string;
    reference?: string;
    notes?: string;
}): Promise<{ success: boolean; payment?: Payment; message?: string }> {
    try {
        await requireRole(['Administrador', 'Ventas']);
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }
    await dbConnect();
    try {
        const payment = await PaymentModel.findById(id);
        if (!payment) {
            return { success: false, message: "Pago no encontrado" };
        }

        // Validate amount change logic
        if (data.amount !== undefined && Math.abs(data.amount - payment.amount) > 0.01) {
            const invoice = await InvoiceModel.findById(payment.invoiceId);
            if (!invoice) {
                return { success: false, message: "Factura asociada no encontrada" };
            }

            // Current paid amount without this payment
            const currentPaidWithoutThis = (invoice.paidAmount || 0) - payment.amount;
            const newTotalPaid = currentPaidWithoutThis + data.amount;

            // Check if new total paid exceeds invoice total
            // Allow small margin
            if (newTotalPaid > invoice.total + 0.01) {
                return { success: false, message: `El nuevo monto excede el total de la factura.` };
            }
        }

        const updatedPayment = await PaymentModel.findByIdAndUpdate(id, data, { new: true });

        // Update invoice Payment Status (recalculates totals)
        if (data.amount !== undefined) {
            await updateInvoicePaymentStatus(payment.invoiceId, id);
        }

        revalidatePath('/invoices');
        revalidatePath('/payments');
        revalidatePath('/dashboard');

        return { success: true, payment: mapPayment(updatedPayment) };
    } catch (error: any) {
        console.error("Error updating payment:", error);
        return { success: false, message: error.message || "Error al actualizar el pago" };
    }
}

// ============= CREDIT NOTES =============

async function generateCreditNoteNumber(): Promise<string> {
    const count = await CreditNoteModel.countDocuments();
    const year = new Date().getFullYear();
    return `NC-${year}-${String(count + 1).padStart(3, '0')}`;
}

export async function createCreditNote(data: {
    originalInvoiceId: string;
    reason: string;
    items: NoteInputItem[];
    discount: number;
    tax: number;
    notes?: string;
    codigoModificacion?: 1 | 2 | 3 | 4;
}): Promise<{ success: boolean; creditNote?: CreditNote; message?: string }> {
    try {
        await requireRole(['Administrador', 'Ventas']);
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }
    await dbConnect();

    return runTransaction(async (session) => {
        const invoice = await InvoiceModel.findById(data.originalInvoiceId).session(session || null);
        if (!invoice) {
            throw new Error("Factura no encontrada");
        }

        // 1. Calculate Totals (Verify backend side)
        const creditItems = data.items.map((item, index) => {
            const subtotal = item.quantity * item.price;
            const discountAmount = (subtotal * item.discount) / 100;
            const total = subtotal - discountAmount;

            return {
                id: String(index + 1),
                productId: item.productId,
                productName: item.productName,
                description: item.description,
                itemType: item.itemType || (isServiceItem(item) ? 'service' : 'product'),
                quantity: item.quantity,
                price: item.price,
                discount: item.discount,
                subtotal,
                total
            };
        });

        const itemsTotal = creditItems.reduce((sum, item) => sum + item.total, 0);
        const total = itemsTotal + data.tax;

        // 2. Determine NCF type: E34 (electronic) if original invoice is electronic, otherwise B04 (traditional)
        const originalNcfType = (invoice.ncfType || '') as string;
        const isElectronic = originalNcfType.startsWith('E');
        const ncfType = isElectronic ? 'E34' : 'B04';
        const ncf = isElectronic
            ? await getNextENCF('E34', session)
            : await getNextNCF('B04', session);
        const number = await generateCreditNoteNumber();

        // 3. Create Credit Note
        const [newCreditNote] = await CreditNoteModel.create([{
            number,
            ncf,
            encf: isElectronic ? ncf : undefined,
            ncfType: ncfType,
            originalInvoiceId: invoice._id,
            originalInvoiceNumber: invoice.number,
            originalInvoiceNcf: invoice.ncf || invoice.encf || '',
            clientId: invoice.clientId,
            clientName: invoice.clientName,
            clientRnc: invoice.clientRnc,
            date: new Date(),
            reason: data.reason,
            codigoModificacion: isElectronic ? (data.codigoModificacion || 1) : undefined,
            subtotal: itemsTotal,
            discount: data.discount,
            tax: data.tax,
            total,
            items: creditItems,
            notes: data.notes
        }], { session });

        // 4. Update Invoice (Add Credit Note reference)
        // We cannot use 'addCreditNoteToInvoice' as it might not accept session or uses a different pattern.
        // It's safer to implement the logic inline here to ensure it uses the Session.
        // Copying logic from addCreditNoteToInvoice but using session:

        const creditAmount = total;
        const newPaidAmount = (invoice.paidAmount || 0) + creditAmount;
        let status = invoice.status;

        if (newPaidAmount >= invoice.total - 0.01) {
            status = "Pagada";
            if (creditAmount >= invoice.total - 0.01) {
                status = "Anulada";
            }
        } else {
            status = "Nota de Crédito Parcial";
        }

        await InvoiceModel.findByIdAndUpdate(invoice._id, {
            $addToSet: { creditNotes: newCreditNote._id },
            $inc: { paidAmount: creditAmount },
            status: status
        }, { session });

        // 5. Return Stock (Bulk)
        const stockItems = toStockItems(data.items);
        await bulkUpdateStock(stockItems, 'add', session);

        return { success: true, creditNote: mapCreditNote(newCreditNote.toObject()) };
    }).catch(error => {
        console.error('Error creating credit note:', error);
        return { success: false, message: error.message || "Error al crear nota de crédito" };
    }).then(res => {
        if (res.success) {
            revalidatePath('/invoices');
            revalidatePath('/payments');
        }
        return res;
    });
}

export async function getCreditNotesByInvoice(invoiceId: string): Promise<CreditNote[]> {
    await dbConnect();
    try {
        const creditNotes = await CreditNoteModel.find({ originalInvoiceId: invoiceId }).sort({ createdAt: -1 }).lean();
        return creditNotes.map(mapCreditNote);
    } catch (error) {
        console.error("Error fetching credit notes:", error);
        return [];
    }
}

export async function getAllCreditNotes(month?: string, year?: string, timezoneOffset?: number): Promise<CreditNote[]> {
    await dbConnect();
    try {
        let query: any = {};

        if (month && year) {
            const offsetMs = (timezoneOffset || 0) * 60 * 1000;
            const startUTC = Date.UTC(parseInt(year), parseInt(month), 1);
            const startDate = new Date(startUTC + offsetMs);
            const endUTC = Date.UTC(parseInt(year), parseInt(month) + 1, 0, 23, 59, 59, 999);
            const endDate = new Date(endUTC + offsetMs);

            query.date = { $gte: startDate, $lte: endDate };
        }

        const creditNotes = await CreditNoteModel.find(query).sort({ createdAt: -1 }).lean();
        return creditNotes.map(mapCreditNote);
    } catch (error) {
        console.error("Error fetching all credit notes:", error);
        return [];
    }
}

export async function getCreditNoteById(id: string): Promise<CreditNote | null> {
    await dbConnect();
    try {
        const creditNote = await CreditNoteModel.findById(id).lean();
        return creditNote ? mapCreditNote(creditNote) : null;
    } catch (error) {
        console.error("Error fetching credit note:", error);
        return null;
    }
}

// ... (existing code)

export async function updateCreditNote(id: string, data: {
    reason: string;
    items: NoteInputItem[];
    notes?: string;
}): Promise<{ success: boolean; creditNote?: CreditNote; message?: string }> {
    try {
        await requireRole(['Administrador', 'Ventas']);
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }
    await dbConnect();

    return runTransaction(async (session) => {
        const creditNote = await CreditNoteModel.findById(id).session(session || null);
        if (!creditNote) {
            throw new Error("Nota de crédito no encontrada");
        }

        if (hasDgiiSubmission(creditNote)) {
            throw new Error("Esta nota de crédito ya fue enviada a la DGII y no puede editarse.");
        }

        const invoice = await InvoiceModel.findById(creditNote.originalInvoiceId).session(session || null);
        if (!invoice) {
            throw new Error("Factura original no encontrada");
        }

        // 1. Revert Old Stock (Deduct what was added)
        // Note: Credit Notes ADD stock. So to clean up old state, we SUBTRACT old quantities.
        const oldItems = toStockItems(creditNote.items as any);
        await bulkUpdateStock(oldItems, 'subtract', session);

        // 2. Revert Old Invoice Balance
        await InvoiceModel.findByIdAndUpdate(invoice._id, {
            $inc: { paidAmount: -creditNote.total }
        }, { session }); // Use updateOne with session

        // 3. Calculate New Totals
        const creditItems = data.items.map((item, index) => {
            const subtotal = item.quantity * item.price;
            const discountAmount = (subtotal * item.discount) / 100;
            const total = subtotal - discountAmount;

            return {
                id: String(index + 1),
                productId: item.productId,
                productName: item.productName,
                description: item.description,
                itemType: item.itemType || (isServiceItem(item) ? 'service' : 'product'),
                quantity: item.quantity,
                price: item.price,
                discount: item.discount,
                subtotal,
                total
            };
        });

        const itemsTotal = creditItems.reduce((sum, item) => sum + item.total, 0);

        let tax = 0;
        if (invoice.subtotal > 0) {
            tax = (itemsTotal / invoice.subtotal) * invoice.tax;
        }

        const total = itemsTotal + tax;

        // 4. Update Credit Note
        const updatedCreditNote = await CreditNoteModel.findByIdAndUpdate(id, {
            reason: data.reason,
            items: creditItems,
            subtotal: itemsTotal,
            tax,
            total,
            notes: data.notes
        }, { new: true, session });

        if (!updatedCreditNote) {
            throw new Error("Error al actualizar la nota de crédito (documento no devuelto)");
        }

        // 5. Apply New Stock (Add quantity back)
        const newItems = toStockItems(data.items);
        await bulkUpdateStock(newItems, 'add', session);

        // 6. Apply New Invoice Balance
        await InvoiceModel.findByIdAndUpdate(invoice._id, {
            $inc: { paidAmount: total }
        }, { session });

        // 7. Update Invoice Status
        const finalInvoice = await InvoiceModel.findById(invoice._id).session(session || null);
        if (finalInvoice) {
            let newStatus = finalInvoice.status;
            const paid = finalInvoice.paidAmount;
            const invTotal = finalInvoice.total;
            const remaining = invTotal - paid;

            // Calculate total credits
            const allCreditNotes = await CreditNoteModel.find({ originalInvoiceId: invoice._id }).session(session || null).lean();
            const totalCredited = allCreditNotes.reduce((sum: any, cn: any) => sum + cn.total, 0);

            if (totalCredited >= invTotal - 0.01) newStatus = 'Anulada';
            else if (remaining <= 0.01) newStatus = 'Pagada';
            else if (remaining >= invTotal - 0.01) newStatus = 'Pendiente';
            else newStatus = 'Nota de Crédito Parcial';

            await InvoiceModel.findByIdAndUpdate(invoice._id, { status: newStatus }, { session });
        }

        return { success: true, creditNote: mapCreditNote(updatedCreditNote.toObject()) };
    }).catch(error => {
        console.error('Error updating credit note:', error);
        return { success: false, message: error.message || "Error al actualizar nota de crédito" };
    }).then(res => {
        if (res.success) {
            revalidatePath('/invoices');
            revalidatePath('/payments');
        }
        return res;
    });
}

export async function deleteCreditNote(id: string): Promise<{ success: boolean; message?: string }> {
    await dbConnect();

    return runTransaction(async (session) => {
        const creditNote = await CreditNoteModel.findById(id).session(session || null);
        if (!creditNote) {
            throw new Error("Nota de crédito no encontrada");
        }

        if (hasDgiiSubmission(creditNote)) {
            throw new Error("Esta nota de crédito ya fue enviada a la DGII y no puede eliminarse.");
        }

        // 1. Revert Stock (Deduct what was added)
        const stockItems = toStockItems(creditNote.items as any);
        await bulkUpdateStock(stockItems, 'subtract', session);

        // 2. Remove reference from Invoice AND Revert Paid Amount
        const invoice = await InvoiceModel.findById(creditNote.originalInvoiceId).session(session || null);
        if (invoice) {
            await InvoiceModel.findByIdAndUpdate(invoice._id, {
                $pull: { creditNotes: id },
                $inc: { paidAmount: -creditNote.total }
            }, { session });

            // Recalculate invoice status
            const updatedInvoice = await InvoiceModel.findById(invoice._id).session(session || null);
            if (updatedInvoice) {
                let newStatus = updatedInvoice.status;
                const remaining = updatedInvoice.total - updatedInvoice.paidAmount;

                const allCreditNotes = await CreditNoteModel.find({
                    originalInvoiceId: invoice._id,
                    _id: { $ne: id }
                }).session(session || null).lean();
                const totalCredited = allCreditNotes.reduce((sum: any, cn: any) => sum + cn.total, 0);

                if (totalCredited >= updatedInvoice.total - 0.01) newStatus = 'Anulada';
                else if (remaining >= updatedInvoice.total - 0.01) newStatus = 'Pendiente';
                else if (remaining <= 0.01) newStatus = 'Pagada';
                else {
                    if (updatedInvoice.creditNotes && updatedInvoice.creditNotes.length > 0) {
                        newStatus = 'Nota de Crédito Parcial';
                    } else {
                        newStatus = 'Parcial';
                    }
                }

                await InvoiceModel.findByIdAndUpdate(invoice._id, { status: newStatus }, { session });
            }
        }

        await CreditNoteModel.findByIdAndDelete(id).session(session || null);

        return { success: true, message: "Nota de crédito eliminada correctamente" };
    }).catch(error => {
        console.error('Error deleting credit note:', error);
        return { success: false, message: error.message || "Error al eliminar nota de crédito" };
    }).then(res => {
        if (res.success) {
            revalidatePath('/invoices');
            revalidatePath('/payments');
        }
        return res;
    });
}

export async function cleanupAllPayments(): Promise<{ success: boolean; message: string; count: number }> {
    try {
        await requireRole(['Administrador']);
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error), count: 0 };
    }
    await dbConnect();
    try {
        const [paymentsBackup, invoicesBackup] = await Promise.all([
            PaymentModel.find({}).lean(),
            InvoiceModel.find({}, 'number total paidAmount status payments').lean(),
        ]);
        const backupFileName = `cleanup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        let backupDir = path.join(process.cwd(), 'scratch', 'backups', 'payments');

        try {
            await mkdir(backupDir, { recursive: true });
        } catch {
            backupDir = path.join('/tmp', 'zarela-erp', 'backups', 'payments');
            await mkdir(backupDir, { recursive: true });
        }

        const backupFile = path.join(backupDir, backupFileName);
        await writeFile(
            backupFile,
            JSON.stringify(
                {
                    createdAt: new Date().toISOString(),
                    payments: paymentsBackup,
                    invoices: invoicesBackup,
                },
                null,
                2
            ),
            'utf8'
        );

        const result = await PaymentModel.deleteMany({});
        const count = result.deletedCount;

        // Recalculate all invoice balances
        await fixInvoiceBalances();

        revalidatePath('/invoices');
        revalidatePath('/payments');
        revalidatePath('/dashboard');
        return { success: true, message: `Se eliminaron ${count} pagos y se recalcularon los saldos. Backup: ${backupFile}`, count };
    } catch (error: any) {
        console.error('Error cleaning up payments:', error);
        return { success: false, message: error.message || "Error al limpiar pagos", count: 0 };
    }
}

// ==================== DEBIT NOTES ====================

async function generateDebitNoteNumber(): Promise<string> {
    const count = await DebitNoteModel.countDocuments();
    const year = new Date().getFullYear();
    return `ND-${year}-${String(count + 1).padStart(3, '0')}`;
}

export async function createDebitNote(data: {
    originalInvoiceId: string;
    reason: string;
    items: NoteInputItem[];
    discount: number;
    tax: number;
    notes?: string;
    codigoModificacion?: 1 | 2 | 3 | 4;
}): Promise<{ success: boolean; debitNote?: any; message?: string }> {
    try {
        await requireRole(['Administrador', 'Ventas']);
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }
    await dbConnect();

    return runTransaction(async (session) => {
        const invoice = await InvoiceModel.findById(data.originalInvoiceId).session(session || null);
        if (!invoice) {
            throw new Error("Factura no encontrada");
        }

        // 1. Calculate Totals
        const debitItems = data.items.map((item, index) => {
            const subtotal = item.quantity * item.price;
            const discountAmount = (subtotal * item.discount) / 100;
            const total = subtotal - discountAmount;

            return {
                id: String(index + 1),
                productId: item.productId,
                productName: item.productName,
                description: item.description,
                itemType: item.itemType || (isServiceItem(item) ? 'service' : 'product'),
                quantity: item.quantity,
                price: item.price,
                discount: item.discount,
                subtotal,
                total
            };
        });

        const itemsTotal = debitItems.reduce((sum, item) => sum + item.total, 0);
        const total = itemsTotal + data.tax;

        // 2. Determine NCF type: E33 (electronic) or B03 (traditional)
        const originalNcfType = (invoice.ncfType || '') as string;
        const isElectronic = originalNcfType.startsWith('E');
        const ncfType = isElectronic ? 'E33' : 'B03';
        const ncf = isElectronic
            ? await getNextENCF('E33', session)
            : await getNextNCF('B03', session);
        const number = await generateDebitNoteNumber();

        // 3. Create Debit Note
        const [newDebitNote] = await DebitNoteModel.create([{
            number,
            ncf,
            encf: isElectronic ? ncf : undefined,
            ncfType: ncfType,
            originalInvoiceId: invoice._id,
            originalInvoiceNumber: invoice.number,
            originalInvoiceNcf: invoice.ncf || invoice.encf || '',
            clientId: invoice.clientId,
            clientName: invoice.clientName,
            clientRnc: invoice.clientRnc,
            date: new Date(),
            reason: data.reason,
            codigoModificacion: isElectronic ? (data.codigoModificacion || 3) : undefined, // Default to "Corrige Montos"
            subtotal: itemsTotal,
            discount: data.discount,
            tax: data.tax,
            total,
            items: debitItems,
            notes: data.notes
        }], { session });

        // 4. Update Invoice: Increase Total and Add Reference
        const newInvoiceTotal = (invoice.total || 0) + total;
        const newInvoiceStatus = getInvoiceStatusAfterBalanceChange({
            total: newInvoiceTotal,
            paidAmount: invoice.paidAmount,
            creditNotes: invoice.creditNotes
        });

        await InvoiceModel.findByIdAndUpdate(invoice._id, {
            $addToSet: { debitNotes: newDebitNote._id },
            $inc: { 
                subtotal: itemsTotal,
                tax: data.tax,
                total: total
            },
            status: newInvoiceStatus
        }, { session });

        // 5. Deduct Stock
        const stockItems = toStockItems(data.items);
        await bulkUpdateStock(stockItems, 'subtract', session);

        return { success: true, debitNote: mapDebitNote(newDebitNote.toObject()) };
    }).catch(error => {
        console.error('Error creating debit note:', error);
        return { success: false, message: error.message || "Error al crear nota de débito" };
    }).then(res => {
        if (res.success) {
            revalidatePath('/invoices');
            revalidatePath('/payments');
        }
        return res;
    });
}

export async function getDebitNotesByInvoice(invoiceId: string): Promise<any[]> {
    await dbConnect();
    try {
        const debitNotes = await DebitNoteModel.find({ originalInvoiceId: invoiceId }).sort({ createdAt: -1 }).lean();
        return debitNotes.map(mapDebitNote);
    } catch (error) {
        console.error("Error fetching debit notes:", error);
        return [];
    }
}

export async function getDebitNoteById(id: string): Promise<any | null> {
    await dbConnect();
    try {
        const debitNote = await DebitNoteModel.findById(id).lean();
        return debitNote ? mapDebitNote(debitNote) : null;
    } catch (error) {
        console.error("Error fetching debit note:", error);
        return null;
    }
}

export async function getAllDebitNotes(month?: string, year?: string, timezoneOffset?: number): Promise<any[]> {
    await dbConnect();
    try {
        let query: any = {};
        if (month && year) {
            const offsetMs = (timezoneOffset || 0) * 60 * 1000;
            const startUTC = Date.UTC(parseInt(year), parseInt(month), 1);
            const startDate = new Date(startUTC + offsetMs);
            const endUTC = Date.UTC(parseInt(year), parseInt(month) + 1, 0, 23, 59, 59, 999);
            const endDate = new Date(endUTC + offsetMs);
            query = { date: { $gte: startDate, $lte: endDate } };
        }
        const debitNotes = await DebitNoteModel.find(query).sort({ createdAt: -1, date: -1 }).lean();
        return debitNotes.map(mapDebitNote);
    } catch (error) {
        console.error("Error fetching all debit notes:", error);
        return [];
    }
}

export async function deleteDebitNote(id: string): Promise<{ success: boolean; message?: string }> {
    try {
        await requireRole(['Administrador', 'Ventas']);
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }
    await dbConnect();

    return runTransaction(async (session) => {
        const debitNote = await DebitNoteModel.findById(id).session(session || null);
        if (!debitNote) {
            throw new Error("Nota de débito no encontrada");
        }

        if (hasDgiiSubmission(debitNote)) {
            throw new Error("Esta nota de débito ya fue enviada a la DGII y no puede eliminarse.");
        }

        // 1. Revert Stock (Debit subtracted, so we ADD back)
        const stockItems = toStockItems(debitNote.items as any);
        await bulkUpdateStock(stockItems, 'add', session);

        // 2. Remove reference and DECREASE Invoice total
        const invoice = await InvoiceModel.findById(debitNote.originalInvoiceId).session(session || null);
        if (invoice) {
            const newInvoiceTotal = (invoice.total || 0) - debitNote.total;
            const remainingDebitNotes = (invoice.debitNotes || []).filter((noteId: any) => noteId.toString() !== id);
            const newInvoiceStatus = getInvoiceStatusAfterBalanceChange({
                total: newInvoiceTotal,
                paidAmount: invoice.paidAmount,
                creditNotes: invoice.creditNotes
            });

            await InvoiceModel.findByIdAndUpdate(invoice._id, {
                $inc: { 
                    subtotal: -debitNote.subtotal,
                    tax: -debitNote.tax,
                    total: -debitNote.total
                },
                debitNotes: remainingDebitNotes,
                status: newInvoiceStatus
            }, { session });
        }

        await DebitNoteModel.findByIdAndDelete(id).session(session || null);

        return { success: true, message: "Nota de débito eliminada correctamente" };
    }).catch(error => {
        console.error('Error deleting debit note:', error);
        return { success: false, message: error.message || "Error al eliminar nota de débito" };
    }).then(res => {
        if (res.success) {
            revalidatePath('/invoices');
        }
        return res;
    });
}
