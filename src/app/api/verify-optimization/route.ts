import { NextResponse } from 'next/server';
import dbConnect, { runTransaction } from '@/lib/db';
import { Product, Invoice, Payment, CreditNote } from '@/models';
import { createInvoice, deleteInvoiceAction } from '@/lib/actions/invoiceActions';
import { createCreditNote } from '@/lib/actions/paymentActions';

export async function GET() {
    await dbConnect();
    const logs: string[] = [];
    const log = (msg: string) => logs.push(msg);

    try {
        log("Iniciando Verificación de Optimización...");

        // 1. Create Test Product
        const product = await Product.create({
            name: "Test Product Optimization",
            price: 100,
            cost: 50,
            stock: 100,
            status: "Activo",
            category: "Test",
            sku: `TEST-${Date.now()}`,
            unit: "Unit",
            type: "Producto Terminado"
        });
        log(`Producto creado: ${product.name} (Stock: ${product.stock})`);

        // 2. Create Invoice
        const invoiceResult = await createInvoice({
            clientId: product._id.toString(),
            clientName: "Test Client",
            ncfType: "B01",
            date: new Date().toISOString(),
            dueDate: new Date().toISOString(),
            items: [{
                productId: product._id.toString(),
                productName: product.name,
                quantity: 10,
                price: 100,
                discount: 0
            }],
            discount: 0,
            tax: 18,
            paymentTerms: "Contado"
        });

        if (!invoiceResult.success || !invoiceResult.invoice) {
            throw new Error(`Fallo al crear factura: ${invoiceResult.message}`);
        }
        log(`Factura creada: ${invoiceResult.invoice.number}`);

        // Verify Stock Subtracted
        const productAfterInvoice = await Product.findById(product._id);
        if (productAfterInvoice?.stock !== 90) {
            throw new Error(`Error de Stock: Esperaba 90, obtuve ${productAfterInvoice?.stock}`);
        }
        log("Stock descontado correctamente (100 -> 90)");

        // 3. Create Credit Note
        const cnResult = await createCreditNote({
            originalInvoiceId: invoiceResult.invoice.id,
            reason: "Devolución prueba",
            items: [{
                productId: product._id.toString(),
                productName: product.name,
                quantity: 5,
                price: 100,
                discount: 0
            }],
            discount: 0,
            tax: 0,
            notes: "Test CN"
        });

        if (!cnResult.success || !cnResult.creditNote) {
            throw new Error(`Fallo al crear Nota de Crédito: ${cnResult.message}`);
        }
        log(`Nota de Crédito creada: ${cnResult.creditNote.number}`);

        // Verify Stock Returned
        const productAfterCN = await Product.findById(product._id);
        if (productAfterCN?.stock !== 95) {
            throw new Error(`Error de Stock post-CN: Esperaba 95, obtuve ${productAfterCN?.stock}`);
        }
        log("Stock retornado correctamente tras NC (90 -> 95)");

        // 4. Delete Invoice
        const deleteResult = await deleteInvoiceAction(invoiceResult.invoice.id);
        if (!deleteResult.success) {
            throw new Error(`Fallo al eliminar factura: ${deleteResult.message}`);
        }
        log("Factura eliminada");

        // Verify Final Stock
        const productFinal = await Product.findById(product._id);
        if (productFinal?.stock !== 100) {
            throw new Error(`Error de Stock Final: Esperaba 100, obtuve ${productFinal?.stock}`);
        }
        log("Stock final restaurado correctamente a 100");

        // Cleanup
        await Product.findByIdAndDelete(product._id);

        return NextResponse.json({ success: true, logs });
    } catch (error: any) {
        log(`ERROR CRITICO: ${error.message}`);
        return NextResponse.json({ success: false, logs }, { status: 500 });
    }
}
