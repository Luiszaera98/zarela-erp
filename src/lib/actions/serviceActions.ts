"use server";

import dbConnect from '@/lib/db';
import { Service as ServiceModel } from '@/models';
import { Service } from '@/types';
import { revalidatePath } from 'next/cache';
import { getAuthErrorMessage, requireRole } from '@/lib/auth/session';

function mapService(doc: any): Service {
    return {
        id: doc._id.toString(),
        name: doc.name,
        code: doc.code,
        category: doc.category,
        description: doc.description,
        price: doc.price || 0,
        unit: doc.unit || 'Unidad',
        status: doc.status || 'Activo',
        createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
        updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt,
    };
}

async function generateServiceCode(): Promise<string> {
    const prefix = 'SRV-';
    const latestService = await ServiceModel.findOne({
        code: { $regex: new RegExp(`^${prefix}`) }
    }).sort({ code: -1 }).lean();

    let sequence = 1;
    if (latestService?.code) {
        const lastSeq = parseInt(latestService.code.replace(prefix, ''), 10);
        if (!isNaN(lastSeq)) {
            sequence = lastSeq + 1;
        }
    }

    return `${prefix}${String(sequence).padStart(4, '0')}`;
}

export async function getServices(
    page: number = 1,
    limit: number = 20,
    search: string = '',
    statusFilter: 'Todos' | 'Activo' | 'Inactivo' = 'Todos'
): Promise<{ services: Service[]; total: number; totalPages: number }> {
    await dbConnect();
    try {
        const query: any = {};

        if (search) {
            const searchRegex = new RegExp(search, 'i');
            query.$or = [
                { name: searchRegex },
                { code: searchRegex },
                { category: searchRegex },
                { description: searchRegex },
            ];
        }

        if (statusFilter !== 'Todos') {
            query.status = statusFilter;
        }

        const skip = (page - 1) * limit;
        const [services, total] = await Promise.all([
            ServiceModel.find(query).sort({ name: 1 }).skip(skip).limit(limit).lean(),
            ServiceModel.countDocuments(query),
        ]);

        return {
            services: services.map(mapService),
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        };
    } catch (error) {
        console.error("Error fetching services:", error);
        return { services: [], total: 0, totalPages: 1 };
    }
}

export async function createService(data: Omit<Service, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ success: boolean; service?: Service; message?: string }> {
    try {
        await requireRole(['Administrador', 'Ventas']);
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }

    await dbConnect();
    try {
        if (!data.name?.trim()) return { success: false, message: "El nombre del servicio es requerido" };
        if (data.price < 0) return { success: false, message: "El precio no puede ser negativo" };

        const service = await ServiceModel.create({
            name: data.name.trim(),
            code: await generateServiceCode(),
            category: data.category?.trim() || undefined,
            description: data.description?.trim() || undefined,
            price: data.price,
            unit: data.unit || 'Por servicio',
            status: data.status || 'Activo',
        });

        revalidatePath('/services');
        return { success: true, service: mapService(service) };
    } catch (error: any) {
        console.error("Error creating service:", error);
        if (error.code === 11000) return { success: false, message: "El código del servicio ya existe" };
        return { success: false, message: error.message || "Error al crear servicio" };
    }
}

export async function updateService(id: string, data: Partial<Service>): Promise<{ success: boolean; service?: Service; message?: string }> {
    try {
        await requireRole(['Administrador', 'Ventas']);
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }

    await dbConnect();
    try {
        const updateData: any = { ...data };
        delete updateData.id;
        delete updateData.code;
        delete updateData.createdAt;
        delete updateData.updatedAt;

        const service = await ServiceModel.findByIdAndUpdate(id, updateData, { new: true, runValidators: true }).lean();
        if (!service) return { success: false, message: "Servicio no encontrado" };

        revalidatePath('/services');
        return { success: true, service: mapService(service) };
    } catch (error: any) {
        console.error("Error updating service:", error);
        if (error.code === 11000) return { success: false, message: "El código del servicio ya existe" };
        return { success: false, message: error.message || "Error al actualizar servicio" };
    }
}

export async function deleteServiceAction(id: string): Promise<{ success: boolean; message?: string }> {
    try {
        await requireRole(['Administrador', 'Ventas']);
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }

    await dbConnect();
    try {
        const result = await ServiceModel.findByIdAndDelete(id);
        if (!result) return { success: false, message: "Servicio no encontrado" };

        revalidatePath('/services');
        return { success: true, message: "Servicio eliminado correctamente" };
    } catch (error: any) {
        console.error("Error deleting service:", error);
        return { success: false, message: error.message || "Error al eliminar servicio" };
    }
}
