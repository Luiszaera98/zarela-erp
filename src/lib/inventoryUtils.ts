import { Product as ProductModel, InventoryMovement as InventoryMovementModel } from '@/models';
import mongoose from 'mongoose';

export type StockOperation = 'add' | 'subtract';

export interface StockItem {
    productId: string;
    productName?: string; // For logging/error messages
    quantity: number;
}

/**
 * Performs a bulk update of product stock.
 * Uses MongoDB bulkWrite for performance.
 * Also records history if metadata is provided.
 * @param items List of items to update
 * @param operation 'add' to increase stock, 'subtract' to decrease
 * @param session Optional Mongoose session for transactions
 * @param metadata Optional metadata to record this movement in history
 */
export async function bulkUpdateStock(
    items: StockItem[],
    operation: StockOperation,
    session?: mongoose.ClientSession,
    metadata?: {
        type?: 'ENTRADA' | 'SALIDA' | 'AJUSTE',
        reference?: string,
        date?: Date | string,
        notes?: string
    }
) {
    if (items.length === 0) return;

    const multiplier = operation === 'add' ? 1 : -1;

    // 1. Update Product Stock
    const operations = items.map(item => ({
        updateOne: {
            filter: { _id: item.productId },
            update: { $inc: { stock: item.quantity * multiplier } }
        }
    }));

    await ProductModel.bulkWrite(operations, { session });

    // 2. Record History (if metadata implies meaningful movement)
    // We default to recording if metadata is passed, or if we want to enforce it globally.
    // For now, only record if metadata is explicitly passed to avoid breaking changes or unwanted logs.
    if (metadata) {
        // Determine type if not provided. 
        // add -> ENTRADA (usually), subtract -> SALIDA (usually)
        const type = metadata.type || (operation === 'add' ? 'ENTRADA' : 'SALIDA');

        // Parse date carefully to avoid timezone shifts (e.g. YYYY-MM-DD becomes previous day if interpreted as UTC 00:00)
        let movementDate = new Date();
        if (metadata.date) {
            if (metadata.date instanceof Date) {
                movementDate = metadata.date;
            } else if (typeof metadata.date === 'string') {
                // If it's a simple date string (YYYY-MM-DD), force noon to stay in same day across Western timestamps
                if (!metadata.date.includes('T')) {
                    movementDate = new Date(`${metadata.date}T12:00:00`);
                } else {
                    movementDate = new Date(metadata.date);
                }
            }
        }

        const movements = items.map(item => ({
            productId: item.productId,
            productName: item.productName || 'Desconocido',
            type: type,
            quantity: item.quantity,
            reference: metadata.reference,
            notes: metadata.notes,
            date: movementDate
        }));

        await InventoryMovementModel.insertMany(movements, { session });
    }
}

/**
 * Validates if there is enough stock for the requested items.
 * Throws an error if stock is insufficient.
 * @param items Items to validate
 */
export async function validateStockAvailability(items: StockItem[]) {
    // Group quantities by product ID (in case the same product is listed twice)
    const demandMap = new Map<string, number>();
    const nameMap = new Map<string, string>();

    for (const item of items) {
        const current = demandMap.get(item.productId) || 0;
        demandMap.set(item.productId, current + item.quantity);
        if (item.productName) nameMap.set(item.productId, item.productName);
    }

    const productIds = Array.from(demandMap.keys());
    const products = await ProductModel.find({ _id: { $in: productIds } }).lean();
    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    for (const [id, requiredQty] of Array.from(demandMap.entries())) {
        const product = productMap.get(id);
        const productName = nameMap.get(id) || 'Producto desconocido';

        if (!product) {
            throw new Error(`Producto no encontrado: ${productName} (ID: ${id})`);
        }

        if (product.stock < requiredQty) {
            throw new Error(`Stock insuficiente para ${product.name}. Disponible: ${product.stock}, Solicitado: ${requiredQty}`);
        }
    }
}
