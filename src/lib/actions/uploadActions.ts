"use server";

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

export async function uploadFile(formData: FormData): Promise<{ success: boolean; url?: string; message?: string }> {
    try {
        const file = formData.get('file') as File;
        if (!file) {
            return { success: false, message: "No se ha proporcionado ningún archivo." };
        }

        const maxSizeBytes = 5 * 1024 * 1024;
        const allowedMimeTypes = new Set([
            'image/jpeg',
            'image/png',
            'image/webp',
            'application/pdf',
        ]);

        if (!allowedMimeTypes.has(file.type)) {
            return { success: false, message: "Tipo de archivo no permitido. Solo se aceptan JPG, PNG, WEBP o PDF." };
        }

        if (file.size > maxSizeBytes) {
            return { success: false, message: "El archivo excede el tamaño máximo permitido de 5 MB." };
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Upload directory
        const uploadDir = join(process.cwd(), 'public', 'uploads', 'expenses');

        // Ensure directory exists
        await mkdir(uploadDir, { recursive: true });

        // Generate unique name
        const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const uniqueName = `${uuidv4()}-${safeFileName}`;
        const filePath = join(uploadDir, uniqueName);

        // Write file
        await writeFile(filePath, buffer);

        // Return URL served via API route to ensure it works in Docker Standalone
        const url = `/api/uploads/expenses/${uniqueName}`;
        return { success: true, url };
    } catch (error: any) {
        console.error("Error uploading file:", error);
        return { success: false, message: "Error al subir el archivo." };
    }
}
