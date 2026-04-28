"use server";

import dbConnect from "@/lib/db";
import { Invoice, Client } from "@/models";
import { revalidatePath } from "next/cache";
import { getAuthErrorMessage, requireRole } from "@/lib/auth/session";
import { randomUUID } from "crypto";

export async function importInvoicesFromJson(jsonData: any[]) {
    try {
        await requireRole(['Administrador']);
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }
    await dbConnect();

    try {
        if (!Array.isArray(jsonData)) {
            return { success: false, message: "El payload de importación debe ser un arreglo." };
        }

        if (jsonData.length > 500) {
            return { success: false, message: "La importación excede el límite de 500 facturas por lote." };
        }

        let count = 0;

        for (const doc of jsonData) {
            // Verificar si ya existe por NCF
            const existing = await Invoice.findOne({ ncf: doc.ncf });

            if (existing) {

                continue;
            }

            // Crear Cliente si no existe (búsqueda simple por nombre)
            let client = await Client.findOne({ name: doc.clientName });

            if (!client) {
                client = await Client.create({
                    name: doc.clientName || "Cliente Importado",
                    contactType: "Cliente",
                    rnc: doc.clientRnc, // Mongoose model uses 'rnc', not 'rncCedula' based on IClient interface? Let's check model.
                    // Checking src/models/index.ts: IClient has 'rnc', 'address', 'email', 'phone'.
                    // We need to provide required fields.
                    email: `importado_${Date.now()}@example.com`, // Placeholder required
                    phone: "000-000-0000", // Placeholder required
                    address: doc.clientAddress || "Dirección Importada",
                    type: "Persona Jurídica", // Default
                    category: "General" // Default
                });
            }

            // Preparar Items
            const itemsData = doc.items.map((item: any) => ({
                id: randomUUID(),
                productId: "imported_product",
                productName: item.productName,
                quantity: item.quantity,
                price: item.price,
                discount: 0,
                subtotal: item.total,
                total: item.total
            }));

            // Crear Factura
            if (doc.type === 'Invoice' || !doc.type) { // Default to Invoice
                await Invoice.create({
                    number: doc.number || `IMP-${Date.now()}-${count}`,
                    ncf: doc.ncf,
                    ncfType: doc.ncfType || 'B01',
                    clientId: client._id, // Mongoose uses _id
                    clientName: client.name,
                    clientRnc: client.rnc,
                    clientAddress: doc.clientAddress || client.address,
                    soldBy: doc.soldBy || "Sistema",
                    sellerEmail: doc.sellerEmail,
                    paymentTerms: doc.paymentTerms,
                    date: new Date(doc.date),
                    dueDate: new Date(doc.dueDate || doc.date),
                    status: doc.status || 'Pendiente',
                    subtotal: doc.subtotal,
                    discount: doc.discount || 0,
                    tax: doc.tax || 0,
                    total: doc.total,
                    paidAmount: doc.paidAmount || 0,
                    items: itemsData
                });
            }

            count++;
        }

        revalidatePath("/invoices");
        return { success: true, message: `Importadas ${count} facturas exitosamente.` };

    } catch (error) {
        console.error("Error importando:", error);
        return { success: false, message: "Error en la importación: " + (error as Error).message };
    }
}
