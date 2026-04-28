"use server";

import dbConnect from '@/lib/db';
import { Product as ProductModel } from '@/models';
import { Product, ProductType } from '@/types';
import { revalidatePath } from 'next/cache';
import { getAuthErrorMessage, requireRole } from '@/lib/auth/session';

// Helper to convert MongoDB document to Product type
function mapProduct(doc: any): Product {
    // Use the stored category directly as the type
    const type = doc.category || doc.type || 'Materia Prima';

    return {
        id: doc._id.toString(),
        name: doc.name,
        type: type,
        sku: doc.sku,
        price: doc.price,
        cost: doc.cost,
        stock: doc.stock || 0,
        minStock: doc.minStock,
        unit: doc.unit,
        description: doc.description,
        category: doc.category, // Keep for backward compat if needed
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
    };
}

async function generateSKU(type: ProductType): Promise<string> {
    // Generate prefix: CHO for Chorizo, first 3 letters for others
    const prefix = type === 'Chorizo' ? 'CHO' : type.substring(0, 3).toUpperCase();

    // Find latest product with this prefix
    const latestProduct = await ProductModel.findOne({
        sku: { $regex: new RegExp(`^${prefix}-`) }
    }).sort({ sku: -1 });

    let sequence = 1;
    if (latestProduct && latestProduct.sku) {
        const parts = latestProduct.sku.split('-');
        if (parts.length === 2) {
            const lastSeq = parseInt(parts[1]);
            if (!isNaN(lastSeq)) {
                sequence = lastSeq + 1;
            }
        }
    }

    return `${prefix}-${String(sequence).padStart(3, '0')}`;
}

export async function getProducts(
    page: number = 1,
    limit: number = 20,
    search: string = '',
    typeFilter: string = 'Todos'
): Promise<{ products: Product[]; total: number; totalPages: number }> {
    await dbConnect();
    try {
        const query: any = {};

        // Search Filter
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            query.$or = [
                { name: searchRegex },
                { sku: searchRegex }
            ];
        }

        // Type Filter
        if (typeFilter !== 'Todos') {
            if (typeFilter === 'Producto Terminado') {
                query.category = 'Chorizo'; // Legacy mapping or consistent with DB
            } else {
                query.category = typeFilter;
            }
        }

        const skip = (page - 1) * limit;

        const [products, total] = await Promise.all([
            ProductModel.find(query)
                .sort({ name: 1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            ProductModel.countDocuments(query)
        ]);

        return {
            products: products.map(mapProduct),
            total,
            totalPages: Math.ceil(total / limit)
        };
    } catch (error) {
        console.error("Error fetching products:", error);
        return { products: [], total: 0, totalPages: 0 };
    }
}

// Modified to make sku and category optional in input, as we handle them
export async function createProduct(data: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'sku' | 'category'> & { sku?: string, category?: string }): Promise<{ success: boolean; product?: Product; message?: string }> {
    try {
        await requireRole(['Administrador', 'Inventario']);
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }
    await dbConnect();
    try {
        // Auto-generate SKU if not provided
        const sku = data.sku || await generateSKU(data.type);

        // Use Type as Category if not provided
        const category = data.category || data.type;

        const newProduct = await ProductModel.create({
            name: data.name,
            sku: sku,
            category: category,
            price: data.price,
            cost: data.cost,
            stock: data.stock,
            description: data.description,
            minStock: data.minStock || 0, // Default to 0 if not provided
            unit: data.unit,
            status: 'Activo'
        });

        revalidatePath('/inventory');
        return { success: true, product: mapProduct(newProduct) };
    } catch (error: any) {
        console.error("Error creating product:", error);
        // Handle duplicate SKU error specifically if needed, though auto-gen should avoid it mostly
        if (error.code === 11000) {
            return { success: false, message: "Error: El código/SKU ya existe. Intente nuevamente." };
        }
        return { success: false, message: error.message || "Error al crear producto" };
    }
}

export async function updateProduct(id: string, data: Partial<Product>): Promise<{ success: boolean; product?: Product; message?: string }> {
    try {
        await requireRole(['Administrador', 'Inventario']);
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }
    await dbConnect();
    try {
        const updateData: any = { ...data };
        delete updateData.id;
        delete updateData.createdAt;
        delete updateData.updatedAt;

        // If type changed, we might want to update category too, but let's keep it simple
        if (data.type) {
            updateData.category = data.type;
        }

        const updatedProduct = await ProductModel.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).lean();

        if (!updatedProduct) {
            return { success: false, message: "Producto no encontrado" };
        }

        revalidatePath('/inventory');
        return { success: true, product: mapProduct(updatedProduct) };
    } catch (error: any) {
        console.error("Error updating product:", error);
        return { success: false, message: error.message || "Error al actualizar producto" };
    }
}

export async function deleteProductAction(id: string): Promise<{ success: boolean; message?: string }> {
    try {
        await requireRole(['Administrador', 'Inventario']);
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }
    await dbConnect();
    try {
        const result = await ProductModel.findByIdAndDelete(id);
        if (!result) {
            return { success: false, message: "Producto no encontrado" };
        }
        revalidatePath('/inventory');
        return { success: true };
    } catch (error: any) {
        console.error("Error deleting product:", error);
        return { success: false, message: error.message || "Error al eliminar producto" };
    }
}

import { bulkUpdateStock } from '@/lib/inventoryUtils';
import { InventoryMovement as InventoryMovementModel } from '@/models';
import { InventoryMovement } from '@/types';

function mapMovement(doc: any): InventoryMovement {
    return {
        id: doc._id.toString(),
        productId: doc.productId,
        productName: doc.productName,
        type: doc.type,
        quantity: doc.quantity,
        reference: doc.reference,
        notes: doc.notes,
        date: doc.date.toISOString(),
        createdAt: doc.createdAt.toISOString()
    };
}

export async function addProductStock(productId: string, quantity: number, date: string, notes?: string): Promise<{ success: boolean; message?: string }> {
    try {
        await requireRole(['Administrador', 'Inventario']);
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }
    await dbConnect();
    try {
        if (quantity <= 0) throw new Error("La cantidad debe ser mayor a 0");

        const product = await ProductModel.findById(productId);
        if (!product) throw new Error("Producto no encontrado");

        await bulkUpdateStock([{ productId, quantity, productName: product.name }], 'add', undefined, {
            type: 'ENTRADA',
            date: date,
            notes: notes || 'Reabastecimiento manual',
            reference: 'Manual'
        });

        revalidatePath('/inventory');
        return { success: true };
    } catch (error: any) {
        console.error("Error adding stock:", error);
        return { success: false, message: error.message };
    }
}

export async function getInventoryMovements(month?: string, year?: string): Promise<InventoryMovement[]> {
    await dbConnect();
    try {
        const query: any = {};

        if (month && year) {
            const m = parseInt(month); // 0-11 if matching Date.getMonth, but UI usually sends 0-11 or 1-12. Let's assume 0-11 from typical JS Date logic, but verify UI.
            // Usually month select is 0-11.
            // Server side logic:
            const y = parseInt(year);

            // Create dates in UTC to match simplistic day filtering or match user timezone?
            // Since we store date as Date object (UTC usually), let's query broadly.
            const startDate = new Date(y, m, 1);
            const endDate = new Date(y, m + 1, 0, 23, 59, 59, 999);

            query.date = { $gte: startDate, $lte: endDate };
        }

        const movements = await InventoryMovementModel.find(query).sort({ date: -1, createdAt: -1 }).lean();
        return movements.map(mapMovement);
    } catch (error) {
        console.error("Error fetching inventory movements:", error);
        return [];
    }
}
