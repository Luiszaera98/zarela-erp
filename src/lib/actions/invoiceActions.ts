"use server";

import dbConnect from '@/lib/db';
import { Invoice as InvoiceModel, Product as ProductModel, Payment as PaymentModel, CreditNote as CreditNoteModel, DebitNote as DebitNoteModel, Client as ClientModel, User as UserModel, InventoryMovement as InventoryMovementModel } from '@/models';
import { Invoice, InvoiceStatus } from '@/types';
import { revalidatePath } from 'next/cache';
import { getNextNCF, getNextENCF, syncNCFSequences } from './settingsActions';
import mongoose from 'mongoose';
import { runTransaction } from '@/lib/db';
import { bulkUpdateStock, validateStockAvailability, StockItem } from '@/lib/inventoryUtils';
import bcrypt from 'bcryptjs';
import { getAuthErrorMessage, requireRole } from '@/lib/auth/session';
import { randomUUID } from 'crypto';

type InvoiceInputItem = {
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

// Helper to convert MongoDB document to Invoice type
function mapInvoice(doc: any): Invoice {
    return {
        id: doc._id.toString(),
        number: doc.number,
        ncf: doc.ncf || 'S/C',
        ncfType: doc.ncfType,
        clientId: doc.clientId,
        clientName: doc.clientName,
        clientRnc: doc.clientRnc,
        clientAddress: doc.clientAddress,
        soldBy: doc.soldBy,
        sellerEmail: doc.sellerEmail,
        paymentTerms: doc.paymentTerms,
        date: doc.date instanceof Date ? doc.date.toISOString() : doc.date,
        dueDate: doc.dueDate instanceof Date ? doc.dueDate.toISOString() : doc.dueDate,
        status: doc.status,
        subtotal: doc.subtotal,
        discount: doc.discount,
        tax: doc.tax,
        total: doc.total,
        paidAmount: doc.paidAmount,
        items: doc.items ? doc.items.map((item: any) => ({ ...item, id: item.id || item._id?.toString(), itemType: item.itemType || (item.productId?.startsWith('SERVICE-') ? 'service' : 'product') })) : [],
        payments: doc.payments,
        creditNotes: doc.creditNotes,
        notes: doc.notes,
        // e-CF fields
        encf: doc.encf,
        ecfStatus: doc.ecfStatus,
        ecfTrackId: doc.ecfTrackId,
        ecfFechaFirma: doc.ecfFechaFirma,
        ecfCodigoSeguridad: doc.ecfCodigoSeguridad,
        createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
        updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt,
    };
}

export async function getInvoices(month?: string, year?: string, timezoneOffset?: number): Promise<Invoice[]> {
    await dbConnect();
    try {
        let query: any = {};

        if (month && year) {
            // timezoneOffset is in minutes (e.g., 240 for UTC-4)
            // We want start date to be 00:00:00 in the user's local time
            // Local = UTC - Offset  =>  UTC = Local + Offset
            const offsetMs = (timezoneOffset || 0) * 60 * 1000;

            // Start of month in UTC
            const startUTC = Date.UTC(parseInt(year), parseInt(month), 1);
            // Adjust to user's local start of month (converted to UTC timestamp)
            const startDate = new Date(startUTC + offsetMs);

            // End of month in UTC
            const endUTC = Date.UTC(parseInt(year), parseInt(month) + 1, 0, 23, 59, 59, 999);
            // Adjust to user's local end of month
            const endDate = new Date(endUTC + offsetMs);

            query = {
                $or: [
                    { date: { $gte: startDate, $lte: endDate } }, // Current month activity
                    { status: { $in: ['Pendiente', 'Parcial', 'Nota de Crédito Parcial', 'Vencida'] } } // All outstanding debt (Global)
                ]
            };
        }

        const invoices = await InvoiceModel.find(query).select('-items -ecfSignedXml').sort({ createdAt: -1 }).lean();
        return invoices.map(mapInvoice);
    } catch (error) {
        console.error("Error fetching invoices:", error);
        return [];
    }
}

export async function getInvoiceById(id: string): Promise<Invoice | null> {
    await dbConnect();
    try {
        // Find in Invoice
        let doc = await InvoiceModel.findById(id).lean();
        if (doc) return mapInvoice(doc);

        // Find in Credit Note
        const cn = await CreditNoteModel.findById(id).lean();
        if (cn) return mapInvoice(cn);

        // Find in Debit Note
        const dn = await DebitNoteModel.findById(id).lean();
        if (dn) return mapInvoice(dn);

        // Find in Expense
        const { Expense: ExpenseModel } = await import('@/models');
        const ex = await ExpenseModel.findById(id).lean();
        if (ex) {
            // Map expense to invoice-like structure for the print page
            return {
                id: ex._id.toString(),
                number: ex.invoiceNumber || ex._id.toString().substring(0, 8),
                ncf: ex.ncf,
                ncfType: ex.ncfType,
                clientId: ex.supplier || '',
                clientName: ex.supplier || 'Proveedor',
                clientRnc: ex.supplierRnc,
                clientAddress: '',
                date: ex.date instanceof Date ? ex.date.toISOString() : ex.date,
                dueDate: ex.date instanceof Date ? ex.date.toISOString() : ex.date,
                status: ex.ecfStatus || 'Pendiente',
                subtotal: ex.amount,
                discount: 0,
                tax: 0,
                total: ex.amount,
                items: [{
                    productName: ex.description || 'Gasto General',
                    quantity: 1,
                    price: ex.amount,
                    total: ex.amount
                }] as any,
                encf: ex.encf,
                ecfStatus: ex.ecfStatus,
                ecfFechaFirma: (ex as any).ecfFechaFirma,
                ecfCodigoSeguridad: (ex as any).ecfCodigoSeguridad,
                createdAt: (ex as any).createdAt,
                updatedAt: (ex as any).updatedAt,
            } as any;
        }

        return null;
    } catch (error) {
        console.error("Error fetching invoice by id:", error);
        return null;
    }
}

async function generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `FAC-${year}-`;

    const invoices = await InvoiceModel.find({
        number: { $regex: new RegExp(`^${prefix}`) }
    }).select('number').lean();

    let maxSequence = 0;

    for (const inv of invoices) {
        const parts = inv.number.split('-');
        const sequence = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(sequence) && sequence > maxSequence) {
            maxSequence = sequence;
        }
    }

    const nextSequence = maxSequence + 1;
    return `${prefix}${String(nextSequence).padStart(3, '0')}`;
}

export async function createInvoice(data: {
    clientId: string;
    clientName: string;
    clientRnc?: string;
    ncfType: string;
    date: string;
    dueDate: string;
    items: InvoiceInputItem[];
    discount: number;
    tax: number;
    notes?: string;
    soldBy?: string;
    sellerEmail?: string;
    paymentTerms?: string;
}): Promise<{ success: boolean; invoice?: Invoice; message?: string }> {
    try {
        await requireRole(['Administrador', 'Ventas']);
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }
    await dbConnect();

    return runTransaction(async (session) => {
        // 1. Validate Stock
        const stockItems: StockItem[] = data.items.filter(i => !isServiceItem(i)).map(i => ({
            productId: i.productId,
            productName: i.productName,
            quantity: i.quantity
        }));

        await validateStockAvailability(stockItems);

        // 2. Calculate Totals
        const productIds = data.items.filter(i => !isServiceItem(i) && mongoose.Types.ObjectId.isValid(i.productId)).map(i => i.productId);
        const products = await ProductModel.find({ _id: { $in: productIds } }).session(session || null).lean();
        const productMap = new Map(products.map(p => [p._id.toString(), p]));

        const invoiceItems = data.items.map((item, index) => {
            const product = productMap.get(item.productId);
            const subtotal = item.quantity * item.price;
            const discountAmount = (subtotal * item.discount) / 100;
            const total = subtotal - discountAmount;

            return {
                id: String(index + 1),
                productId: item.productId,
                productName: item.productName,
                description: isServiceItem(item) ? item.description : product?.description,
                itemType: isServiceItem(item) ? 'service' : 'product',
                quantity: item.quantity,
                price: item.price,
                discount: item.discount,
                subtotal,
                total
            };
        });

        const itemsTotal = invoiceItems.reduce((sum, item) => sum + item.total, 0);
        const generalDiscountAmount = (itemsTotal * data.discount) / 100;
        const subtotal = itemsTotal - generalDiscountAmount;
        const total = subtotal + data.tax;

        // 3. Generate Numbers
        const invoiceNumber = await generateInvoiceNumber();

        // Check contingency mode — if active, e-NCF types fall back to B series
        let effectiveNcfType = data.ncfType;
        let isContingencyInvoice = false;

        if (data.ncfType.startsWith('E')) {
            const { isContingencyActive } = await import('./ecfContingencyActions');
            const contingencyActive = await isContingencyActive();

            if (contingencyActive) {
                // E31 (Crédito Fiscal) → B01, E32 (Consumo) → B02
                const fallbackMap: Record<string, string> = {
                    'E31': 'B01',
                    'E32': 'B02',
                };
                effectiveNcfType = (fallbackMap[data.ncfType] || 'B02') as any;
                isContingencyInvoice = true;
                console.log(`[CONTINGENCIA] Factura ${invoiceNumber}: ${data.ncfType} → ${effectiveNcfType}`);
            }
        }

        let ncf = undefined; // Leave undefined for S/C to avoid unique constraint (sparse index)
        if (effectiveNcfType !== 'S/C') {
            // e-NCF (E31, E32, etc.) usa 10 dígitos de secuencia = 13 chars total
            // NCF tradicional (B01, B02, etc.) usa 8 dígitos de secuencia = 11 chars total
            if (effectiveNcfType.startsWith('E')) {
                ncf = await getNextENCF(effectiveNcfType, session);
            } else {
                ncf = await getNextNCF(effectiveNcfType, session);
            }
        }

        // Fetch client to get address and exemption code
        const client = await ClientModel.findById(data.clientId).session(session || null);
        const clientAddress = client ? client.address : '';
        const taxExemptionCode = (client as any)?.taxExemptionCode;

        // 4. Create Invoice
        const [newInvoice] = await InvoiceModel.create([{
            number: invoiceNumber,
            ncf,
            ncfType: effectiveNcfType,
            clientId: data.clientId,
            clientName: data.clientName,
            clientRnc: data.clientRnc,
            clientAddress: clientAddress,
            soldBy: data.soldBy,
            sellerEmail: data.sellerEmail,
            paymentTerms: data.paymentTerms,
            date: data.date,
            dueDate: data.dueDate,
            status: "Pendiente",
            subtotal,
            discount: data.discount,
            tax: data.tax,
            total,
            paidAmount: 0,
            items: invoiceItems,
            notes: data.notes,
            payments: [],
            creditNotes: [],
            taxExemptionCode,
            // Mark as contingency if issued during contingency mode
            ...(isContingencyInvoice ? { ecfStatus: 'Contingencia' } : {}),
        }], { session });

        // 5. Update Inventory Stock & Log Movement
        await bulkUpdateStock(stockItems, 'subtract', session, {
            type: 'SALIDA',
            reference: invoiceNumber, // Use Invoice Number as reference linked to this operation
            date: data.date,
            notes: `Factura ${invoiceNumber}`
        });

        return { success: true, invoice: mapInvoice(newInvoice.toObject()) };
    }).catch(async (error) => {
        console.error('Error creating invoice:', error);

        if (error.code === 11000 && error.keyPattern && error.keyPattern.ncf) {
            console.log("Duplicate NCF detected, attempting to sync...");
            await syncNCFSequences({ skipAuth: true });
            return { success: false, message: "Error de secuencia NCF (duplicado), intente de nuevo." };
        }

        return { success: false, message: error.message || "Error al crear la factura" };
    }).then(res => {
        if (res.success) {
            revalidatePath('/invoices');
            revalidatePath('/inventory');
        }
        return res;
    });
}

export async function updateInvoice(id: string, data: {
    clientId: string;
    clientName: string;
    clientRnc?: string;
    ncfType: string;
    date: string;
    dueDate: string;
    status: string;
    items: InvoiceInputItem[];
    discount: number;
    tax: number;
    notes?: string;
    paymentTerms?: string;
    soldBy?: string;
    sellerEmail?: string;
}): Promise<{ success: boolean; invoice?: Invoice; message?: string }> {
    try {
        await requireRole(['Administrador', 'Ventas']);
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }
    await dbConnect();

    return runTransaction(async (session) => {
        const existingInvoice = await InvoiceModel.findById(id).session(session || null);
        if (!existingInvoice) {
            throw new Error("Factura no encontrada");
        }

        // 1. Revert Old Stock (PHYSICAL ONLY, NO LOG)
        // We do NOT pass metadata here, so no 'ENTRADA' log is created.
        const oldItems: StockItem[] = existingInvoice.items.filter((i: any) => !isServiceItem(i)).map((i: any) => ({
            productId: i.productId, quantity: i.quantity
        }));
        await bulkUpdateStock(oldItems, 'add', session);

        // 2. Remove Old History Logs
        // Per user request: eliminate the output record if invoice is modified
        await InventoryMovementModel.deleteMany({ reference: existingInvoice.number }, { session });

        // 3. Validate & Prepare New Items
        const newItems: StockItem[] = data.items.filter(i => !isServiceItem(i)).map(i => ({
            productId: i.productId, quantity: i.quantity, productName: i.productName
        }));

        if (session) {
            const productIds = newItems.map(i => i.productId);
            const products = await ProductModel.find({ _id: { $in: productIds } }).session(session).lean();
            const productMap = new Map(products.map(p => [p._id.toString(), p]));
            for (const item of newItems) {
                const prod = productMap.get(item.productId);
                if (prod && prod.stock < item.quantity) {
                    throw new Error(`Stock insuficiente para ${item.productName} (después de devolución). Disp: ${prod.stock}`);
                }
            }
        }

        // 4. Update Stock & Create New Logs
        await bulkUpdateStock(newItems, 'subtract', session, {
            type: 'SALIDA',
            reference: existingInvoice.number, // Reuse existing number
            date: data.date,
            notes: `Factura ${existingInvoice.number} (Editada)`
        });

        // Calculate item totals
        const invoiceItems = await Promise.all(data.items.map(async (item, index) => {
            const product = !isServiceItem(item) ? await ProductModel.findById(item.productId).session(session || null).lean() : null;

            const subtotal = item.quantity * item.price;
            const discountAmount = (subtotal * item.discount) / 100;
            const total = subtotal - discountAmount;

            return {
                id: String(index + 1),
                productId: item.productId,
                productName: item.productName,
                description: isServiceItem(item) ? item.description : product?.description,
                itemType: isServiceItem(item) ? 'service' : 'product',
                quantity: item.quantity,
                price: item.price,
                discount: item.discount,
                subtotal,
                total
            };
        }));

        const itemsTotal = invoiceItems.reduce((sum, item) => sum + item.total, 0);
        const generalDiscountAmount = (itemsTotal * data.discount) / 100;
        const subtotal = itemsTotal - generalDiscountAmount;
        const total = subtotal + data.tax;

        // Fetch client to get address (if client changed or just to ensure it's up to date)
        const client = await ClientModel.findById(data.clientId).session(session || null);
        const clientAddress = client ? client.address : '';

        const updatedInvoice = await InvoiceModel.findByIdAndUpdate(
            id,
            {
                clientId: data.clientId,
                clientName: data.clientName,
                clientRnc: data.clientRnc,
                clientAddress: clientAddress,
                ncfType: data.ncfType,
                date: data.date,
                dueDate: data.dueDate,
                status: data.status,
                subtotal,
                discount: data.discount,
                tax: data.tax,
                total,
                items: invoiceItems,
                notes: data.notes,
                paymentTerms: data.paymentTerms,
                soldBy: data.soldBy,
                sellerEmail: data.sellerEmail,
            },
            { new: true, session }
        ).lean();

        return { success: true, invoice: mapInvoice(updatedInvoice) };

    }).catch(error => {
        console.error('Error updating invoice:', error);
        return { success: false, message: error.message || "Error al actualizar la factura" };
    }).then(res => {
        if (res.success) {
            revalidatePath('/invoices');
            revalidatePath('/inventory');
        }
        return res;
    });
}

export async function deleteInvoiceAction(id: string): Promise<{ success: boolean; message?: string }> {
    try {
        await requireRole(['Administrador', 'Ventas']);
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }
    await dbConnect();

    return runTransaction(async (session) => {
        const invoice = await InvoiceModel.findById(id).session(session || null);
        if (!invoice) {
            throw new Error("Factura no encontrada");
        }

        // 1. Restore Stock (PHYSICAL ONLY, NO LOG)
        const stockItems: StockItem[] = invoice.items.filter((i: any) => !isServiceItem(i)).map((i: any) => ({
            productId: i.productId, quantity: i.quantity
        }));
        await bulkUpdateStock(stockItems, 'add', session);

        // 2. Remove History Logs
        await InventoryMovementModel.deleteMany({ reference: invoice.number }, { session });

        // Cascade delete Credit Notes (and revert their stock effect)
        const creditNotes = await CreditNoteModel.find({ originalInvoiceId: id }).session(session || null);

        for (const cn of creditNotes) {
            const cnItems: StockItem[] = cn.items.filter((i: any) => !isServiceItem(i)).map((i: any) => ({
                productId: i.productId, quantity: i.quantity
            }));
            await bulkUpdateStock(cnItems, 'subtract', session);
            await CreditNoteModel.findByIdAndDelete(cn._id).session(session || null);
        }

        // Cascade delete Payments
        await PaymentModel.deleteMany({ invoiceId: id }).session(session || null);

        await InvoiceModel.findByIdAndDelete(id).session(session || null);

        return { success: true, message: "Factura eliminada correctamente" };
    }).catch(error => {
        console.error('Error deleting invoice:', error);
        return { success: false, message: error.message || "Error al eliminar factura" };
    }).then(async res => {
        if (res && res.success) {
            await syncNCFSequences();
            revalidatePath('/invoices');
            revalidatePath('/inventory');
        }
        return res;
    });
}

export async function updateInvoicePaymentStatus(invoiceId: string, paymentId: string, removePayment: boolean = false): Promise<void> {
    await requireRole(['Administrador', 'Ventas']);
    await dbConnect();

    const payments = await PaymentModel.find({ invoiceId });

    // Filter out the payment to be removed if applicable
    const effectivePayments = removePayment
        ? payments.filter(p => p._id.toString() !== paymentId)
        : payments;

    const totalPaid = effectivePayments.reduce((sum, p) => sum + p.amount, 0);

    const invoice = await InvoiceModel.findById(invoiceId);
    if (!invoice) return;

    let status: InvoiceStatus = invoice.status as InvoiceStatus;

    if (totalPaid === 0) {
        status = "Pendiente";
    } else if (totalPaid >= invoice.total) {
        status = "Pagada";
    } else {
        status = "Parcial";
    }

    let updateQuery: any = {
        paidAmount: totalPaid,
        status: status
    };

    if (removePayment) {
        updateQuery.$pull = { payments: paymentId };
    } else {
        updateQuery.$addToSet = { payments: paymentId };
    }

    await InvoiceModel.findByIdAndUpdate(invoiceId, updateQuery);
    revalidatePath('/invoices');
}

export async function addCreditNoteToInvoice(invoiceId: string, creditNoteId: string, creditAmount: number): Promise<void> {
    await requireRole(['Administrador', 'Ventas']);
    await dbConnect();

    const invoice = await InvoiceModel.findById(invoiceId);
    if (!invoice) return;

    const newPaidAmount = (invoice.paidAmount || 0) + creditAmount;

    let status: InvoiceStatus = invoice.status as InvoiceStatus;

    if (newPaidAmount >= invoice.total - 0.01) {
        status = "Pagada";
        if (creditAmount >= invoice.total - 0.01) {
            status = "Anulada";
        }
    } else {
        status = "Nota de Crédito Parcial";
    }

    let updateQuery: any = {
        $addToSet: { creditNotes: creditNoteId },
        $inc: { paidAmount: creditAmount },
        status: status
    };

    await InvoiceModel.findByIdAndUpdate(invoiceId, updateQuery);
    revalidatePath('/invoices');
}

export async function fixInvoiceBalances(): Promise<void> {
    await requireRole(['Administrador']);
    await dbConnect();
    try {
        const invoices = await InvoiceModel.find({});

        // Aggregate payments by invoice
        const payments = await PaymentModel.aggregate([
            { $group: { _id: "$invoiceId", totalPaid: { $sum: "$amount" } } }
        ]);
        const paymentMap = new Map(payments.map(p => [p._id.toString(), p.totalPaid]));

        // Aggregate credit notes by invoice
        const creditNotes = await CreditNoteModel.aggregate([
            { $group: { _id: "$originalInvoiceId", totalCredit: { $sum: "$total" } } }
        ]);
        const creditNoteMap = new Map(creditNotes.map(c => [c._id.toString(), c.totalCredit]));

        const bulkOps = [];

        for (const invoice of invoices) {
            const paymentsTotal = paymentMap.get(invoice._id.toString()) || 0;
            const creditNotesTotal = creditNoteMap.get(invoice._id.toString()) || 0;
            const totalPaid = paymentsTotal + creditNotesTotal;

            let status = invoice.status;
            if (totalPaid >= invoice.total - 0.01) {
                status = "Pagada";
                if (creditNotesTotal >= invoice.total - 0.01 && paymentsTotal === 0) {
                    status = "Anulada";
                }
            } else if (totalPaid > 0) {
                if (creditNotesTotal > 0) {
                    status = "Nota de Crédito Parcial";
                } else {
                    status = "Parcial";
                }
            } else {
                status = "Pendiente";
            }

            if (Math.abs((invoice.paidAmount || 0) - totalPaid) > 0.01 || invoice.status !== status) {
                bulkOps.push({
                    updateOne: {
                        filter: { _id: invoice._id },
                        update: { paidAmount: totalPaid, status: status }
                    }
                });
            }
        }

        if (bulkOps.length > 0) {
            await InvoiceModel.bulkWrite(bulkOps);
        }

        revalidatePath('/invoices');
        revalidatePath('/dashboard');
    } catch (error) {
        console.error("Error fixing invoice balances:", error);
    }
}

export async function importInvoiceFromJSON(data: any): Promise<{ success: boolean; message: string; invoiceId?: string }> {
    try {
        await requireRole(['Administrador']);
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }
    await dbConnect();

    try {
        let client = await ClientModel.findOne({
            $or: [
                { rnc: data.clientRnc },
                { name: data.clientName }
            ]
        });

        if (!client) {
            const safeRnc = data.clientRnc || `NORNC-${Date.now()}`;
            const safeName = data.clientName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            let dummyEmail = data.clientRnc ? `${data.clientRnc}@cliente.local` : `${safeName}@cliente.local`;

            let existingEmail = await ClientModel.findOne({ email: dummyEmail });
            if (existingEmail) {
                dummyEmail = `${safeName}-${Date.now()}@cliente.local`;
            }

            client = await ClientModel.create({
                name: data.clientName,
                rnc: data.clientRnc || "",
                address: data.clientAddress || "Dirección no disponible",
                email: dummyEmail,
                phone: "809-000-0000",
                contactType: "Cliente",
                type: "Persona Jurídica",
                category: "General",
                status: "Activo"
            });
        }

        if (data.soldBy && data.sellerEmail) {
            let seller = await UserModel.findOne({ email: data.sellerEmail });
            if (!seller) {
                try {
                    const defaultPwd = process.env.SALES_PASSWORD?.trim();
                    if (!defaultPwd) {
                        throw new Error("SALES_PASSWORD no está configurado para crear vendedores importados.");
                    }
                    await UserModel.create({
                        name: data.soldBy,
                        email: data.sellerEmail,
                        password: await bcrypt.hash(defaultPwd, 10),
                        role: "Comercial",
                        status: "Activo"
                    });
                } catch (err) {
                    console.error("Error creating seller:", err);
                }
            }
        }

        const items = [];
        for (const item of data.items) {
            let product = await ProductModel.findOne({ name: item.productName });

            if (!product) {
                product = await ProductModel.create({
                    name: item.productName,
                    sku: `IMP-${Math.floor(Math.random() * 100000)}`,
                    type: "Producto Terminado",
                    category: "Importado",
                    price: item.price,
                    cost: item.price * 0.7,
                    stock: 100,
                    unit: "Unidad",
                    status: "Activo"
                });
            }

            items.push({
                id: randomUUID(),
                productId: product._id.toString(),
                productName: product.name,
                quantity: item.quantity,
                price: item.price,
                discount: 0,
                subtotal: item.total,
                total: item.total
            });
        }

        const existingInvoice = await InvoiceModel.findOne({ number: data.number });
        if (existingInvoice) {
            return { success: false, message: `La factura ${data.number} ya existe.` };
        }

        const newInvoice = await InvoiceModel.create({
            number: data.number,
            ncf: data.ncf,
            ncfType: data.ncfType,
            clientId: client._id,
            clientName: client.name,
            clientRnc: client.rnc,
            clientAddress: client.address,
            soldBy: data.soldBy,
            sellerEmail: data.sellerEmail,
            paymentTerms: data.paymentTerms,
            date: new Date(data.date),
            dueDate: new Date(data.dueDate),
            status: data.status,
            subtotal: data.subtotal,
            discount: data.discount,
            tax: data.tax,
            total: data.total,
            paidAmount: data.paidAmount,
            items: items,
            notes: "Importada desde JSON",
            payments: [],
            creditNotes: []
        });

        revalidatePath('/invoices');
        return { success: true, message: "Factura importada correctamente", invoiceId: newInvoice._id.toString() };

    } catch (error: any) {
        console.error("Error importing invoice:", error);
        return { success: false, message: error.message || "Error al importar factura" };
    }
}

export async function importBulkInvoices(invoices: any[]): Promise<{ success: boolean; count: number; errors: string[] }> {
    try {
        await requireRole(['Administrador']);
    } catch (error) {
        return { success: false, count: 0, errors: [getAuthErrorMessage(error)] };
    }
    await dbConnect();
    let count = 0;
    const errors: string[] = [];

    for (const invoiceData of invoices) {
        try {
            const result = await importInvoiceFromJSON(invoiceData);
            if (result.success) {
                count++;
            } else {
                errors.push(`Factura ${invoiceData.number}: ${result.message}`);
            }
        } catch (err: any) {
            errors.push(`Factura ${invoiceData.number}: ${err.message}`);
        }
    }

    revalidatePath('/invoices');
    return { success: true, count, errors };
}

export async function markAllInvoicesAsPaidExcept(excludedNumbers: string[]) {
    try {
        await requireRole(['Administrador']);
    } catch (error) {
        return { success: false, count: 0, message: getAuthErrorMessage(error) };
    }
    await dbConnect();
    const invoices = await InvoiceModel.find({});
    let count = 0;

    for (const invoice of invoices) {
        const parts = invoice.number.split('-');
        const numberPart = parts[parts.length - 1];

        if (excludedNumbers.includes(numberPart)) {
            continue;
        }

        if (invoice.status === 'Pagada') continue;

        const paymentDate = new Date(invoice.date);
        paymentDate.setDate(paymentDate.getDate() + 15);

        const payment = await PaymentModel.create({
            invoiceId: invoice._id,
            invoiceNumber: invoice.number,
            amount: invoice.total,
            paymentMethod: 'Transferencia',
            paymentDate: paymentDate,
            notes: 'Pago automático (migración)',
            createdBy: 'Sistema'
        });

        await InvoiceModel.findByIdAndUpdate(invoice._id, {
            status: 'Pagada',
            paidAmount: invoice.total,
            $push: { payments: payment._id }
        });
        count++;
    }
    revalidatePath('/invoices');
    return { success: true, count };
}

export async function deleteInvalidInvoices() {
    try {
        await requireRole(['Administrador']);
    } catch (error) {
        return { success: false, count: 0, message: getAuthErrorMessage(error) };
    }
    await dbConnect();
    const invoices = await InvoiceModel.find({});
    let count = 0;

    for (const invoice of invoices) {
        const regex = /^FAC-\d{4}-\d+$/;

        if (!regex.test(invoice.number)) {
            await PaymentModel.deleteMany({ invoiceId: invoice._id });
            await InvoiceModel.findByIdAndDelete(invoice._id);
            count++;
        }
    }
    revalidatePath('/invoices');
    return { success: true, count };
}
