"use server";

import dbConnect from '@/lib/db';
import { Client as ClientModel, Invoice as InvoiceModel } from '@/models';
import { Client } from '@/types';
import { revalidatePath } from 'next/cache';
import { getAuthErrorMessage, requireSession } from '@/lib/auth/session';

// Helper to convert MongoDB document to Client type
function mapClient(doc: any): Client {
    return {
        id: doc._id.toString(),
        name: doc.name,
        contactType: doc.contactType || (doc.category === 'Empleado' ? 'Empleado' : (doc.type === 'Persona Física' ? 'Cliente' : 'Empresa')),
        rncCedula: doc.rnc || '',
        email: doc.email,
        phoneNumber: doc.phone,
        address: doc.address || '',
        taxExemptionCode: doc.taxExemptionCode,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
    };
}

export async function getClients(
    page: number = 1,
    limit: number = 20,
    search: string = '',
    typeFilter: string = 'Todos'
): Promise<{ clients: Client[]; total: number; totalPages: number }> {
    await dbConnect();
    try {
        const query: any = {};
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            query.$or = [
                { name: searchRegex },
                { rnc: searchRegex },
                { email: searchRegex }
            ];
        }

        if (typeFilter !== 'Todos') {
            query.contactType = typeFilter;
        }

        const skip = (page - 1) * limit;
        const [clients, total] = await Promise.all([
            ClientModel.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            ClientModel.countDocuments(query)
        ]);

        return {
            clients: clients.map(mapClient),
            total,
            totalPages: Math.ceil(total / limit)
        };
    } catch (error) {
        console.error("Error fetching clients:", error);
        return { clients: [], total: 0, totalPages: 0 };
    }
}

export async function getClientById(id: string): Promise<Client | null> {
    await dbConnect();
    try {
        const client = await ClientModel.findById(id).lean();
        if (!client) return null;
        return mapClient(client);
    } catch (error) {
        console.error("Error fetching client by ID:", error);
        return null;
    }
}

export async function getContacts(): Promise<{ id: string; name: string; type: string; rncCedula?: string }[]> {
    await dbConnect();
    try {
        const contacts = await ClientModel.find({}, 'name contactType rnc').sort({ name: 1 }).lean();
        return contacts.map((c: any) => ({
            id: c._id.toString(),
            name: c.name,
            type: c.contactType || 'Cliente',
            rncCedula: c.rnc || undefined,
        }));
    } catch (error) {
        console.error("Error fetching contacts:", error);
        return [];
    }
}

export async function createClient(data: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ success: boolean; client?: Client; message?: string }> {
    try {
        await requireSession();
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }
    await dbConnect();
    try {
        const newClient = await ClientModel.create({
            name: data.name,
            email: data.email || undefined,
            phone: data.phoneNumber || undefined,
            address: data.address || 'N/A',
            rnc: data.rncCedula,
            type: data.contactType === 'Cliente' ? 'Persona Física' : 'Persona Jurídica',
            contactType: data.contactType,
            category: data.contactType === 'Empleado' ? 'Empleado' : 'General',
            taxExemptionCode: data.taxExemptionCode,
            status: 'Activo'
        });

        revalidatePath('/clients');
        return { success: true, client: mapClient(newClient) };
    } catch (error: any) {
        console.error("Error creating client:", error);
        return { success: false, message: error.message || "Error al crear cliente" };
    }
}

export async function updateClient(id: string, data: Partial<Client>): Promise<{ success: boolean; client?: Client; message?: string }> {
    try {
        await requireSession();
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }
    await dbConnect();
    try {
        const updateData: any = {};
        if (data.name) updateData.name = data.name;
        if (data.email !== undefined) updateData.email = data.email || undefined;
        if (data.phoneNumber !== undefined) updateData.phone = data.phoneNumber || undefined;
        if (data.address) updateData.address = data.address;
        if (data.rncCedula) updateData.rnc = data.rncCedula;
        if (data.contactType) {
            updateData.contactType = data.contactType;
            updateData.type = data.contactType === 'Cliente' ? 'Persona Física' : 'Persona Jurídica';
            updateData.category = data.contactType === 'Empleado' ? 'Empleado' : 'General';
        }
        if (data.taxExemptionCode !== undefined) updateData.taxExemptionCode = data.taxExemptionCode;

        const updatedClient = await ClientModel.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).lean();

        if (!updatedClient) {
            return { success: false, message: "Cliente no encontrado" };
        }

        // Update invoices if name or RNC changed
        if (data.name || data.rncCedula) {
            const invoiceUpdate: any = {};
            if (data.name) invoiceUpdate.clientName = data.name;
            if (data.rncCedula) invoiceUpdate.clientRnc = data.rncCedula;

            await InvoiceModel.updateMany({ clientId: id }, invoiceUpdate);
        }

        revalidatePath('/clients');
        revalidatePath('/invoices');
        return { success: true, client: mapClient(updatedClient) };
    } catch (error: any) {
        console.error("Error updating client:", error);
        return { success: false, message: error.message || "Error al actualizar cliente" };
    }
}

export async function deleteClientAction(id: string): Promise<{ success: boolean; message?: string }> {
    try {
        await requireSession();
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }
    await dbConnect();
    try {
        const result = await ClientModel.findByIdAndDelete(id);
        if (!result) {
            return { success: false, message: "Cliente no encontrado" };
        }
        revalidatePath('/clients');
        return { success: true };
    } catch (error: any) {
        console.error("Error deleting client:", error);
        return { success: false, message: error.message || "Error al eliminar cliente" };
    }
}

export async function uppercaseAllClientNames() {
    try {
        await requireSession();
    } catch (error) {
        return { success: false, count: 0, message: getAuthErrorMessage(error) };
    }
    await dbConnect();
    const clients = await ClientModel.find({});
    let count = 0;

    for (const client of clients) {
        if (client.name) {
            // Convert to UPPERCASE: "juan perez" -> "JUAN PEREZ"
            const newName = client.name.toUpperCase();

            if (newName !== client.name) {
                await ClientModel.findByIdAndUpdate(client._id, { name: newName });
                // Update invoices too
                await InvoiceModel.updateMany({ clientId: client._id }, { clientName: newName });
                count++;
            }
        }
    }
    revalidatePath('/clients');
    revalidatePath('/invoices');
    return { success: true, count };
}
