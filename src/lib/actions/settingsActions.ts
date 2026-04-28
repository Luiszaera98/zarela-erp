"use server";

import dbConnect from '@/lib/db';
import { User, Sequence, Configuration, Invoice as InvoiceModel } from '@/models';
import { revalidatePath } from 'next/cache';
import { getAuthErrorMessage, mapRoleFromDb, mapRoleToDb, requireRole, requireSession } from '@/lib/auth/session';
import bcrypt from 'bcryptjs';

// ==================== CONFIGURATION (Product Lists) ====================

const DEFAULT_CHORIZO_TYPES = [
    "Chorizo de Cerdo",
    "Chorizo de Res",
    "Chorizo Mixto",
    "Chorizo Picante",
    "Chorizo Ahumado",
    "Longaniza",
    "Salchicha Parrillera",
    "Butifarra"
];

function normalizeConfigName(value: string): string {
    return value.trim().replace(/\s+/g, ' ').toUpperCase();
}

export async function getChorizoTypes(): Promise<string[]> {
    await dbConnect();
    try {
        let config = await Configuration.findOne({ key: 'chorizo_types' });

        if (!config) {
            // Initialize if not exists
            config = await Configuration.create({
                key: 'chorizo_types',
                value: DEFAULT_CHORIZO_TYPES
            });
        }

        const normalizedTypes = (config.value as string[]).map(normalizeConfigName);
        if (JSON.stringify(config.value) !== JSON.stringify(normalizedTypes)) {
            config.value = normalizedTypes;
            config.markModified('value');
            await config.save();
        }

        return normalizedTypes;
    } catch (error) {
        console.error("Error fetching chorizo types:", error);
        return DEFAULT_CHORIZO_TYPES.map(normalizeConfigName);
    }
}

export async function addChorizoType(type: string): Promise<{ success: boolean; message?: string }> {
    try {
        await requireSession();
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }
    await dbConnect();
    try {
        const normalizedType = normalizeConfigName(type);
        const config = await Configuration.findOne({ key: 'chorizo_types' });
        if (!config) {
            await Configuration.create({ key: 'chorizo_types', value: [...DEFAULT_CHORIZO_TYPES.map(normalizeConfigName), normalizedType] });
        } else {
            const types = (config.value as string[]).map(normalizeConfigName);
            if (!types.includes(normalizedType)) {
                types.push(normalizedType);
                config.value = types;
                // Mark as modified because 'value' is Mixed type
                config.markModified('value');
                await config.save();
            }
        }
        revalidatePath('/settings');
        revalidatePath('/inventory');
        return { success: true };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function removeChorizoType(type: string): Promise<{ success: boolean; message?: string }> {
    try {
        await requireSession();
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }
    await dbConnect();
    try {
        const config = await Configuration.findOne({ key: 'chorizo_types' });
        if (config) {
            const normalizedType = normalizeConfigName(type);
            const types = (config.value as string[]).map(normalizeConfigName);
            const newTypes = types.filter(t => t !== normalizedType);
            config.value = newTypes;
            config.markModified('value');
            await config.save();
        }
        revalidatePath('/settings');
        revalidatePath('/inventory');
        return { success: true };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

const DEFAULT_UNIT_TYPES = [
    "Unidad",
    "Libras",
    "Kilos",
    "Paquete",
    "Caja"
];

export async function getUnitTypes(): Promise<string[]> {
    await dbConnect();
    try {
        let config = await Configuration.findOne({ key: 'unit_types' });

        if (!config) {
            config = await Configuration.create({
                key: 'unit_types',
                value: DEFAULT_UNIT_TYPES
            });
        }

        return config.value as string[];
    } catch (error) {
        console.error("Error fetching unit types:", error);
        return DEFAULT_UNIT_TYPES;
    }
}

export async function addUnitType(type: string): Promise<{ success: boolean; message?: string }> {
    try {
        await requireSession();
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }
    await dbConnect();
    try {
        const config = await Configuration.findOne({ key: 'unit_types' });
        if (!config) {
            await Configuration.create({ key: 'unit_types', value: [...DEFAULT_UNIT_TYPES, type] });
        } else {
            const types = config.value as string[];
            if (!types.includes(type)) {
                types.push(type);
                config.value = types;
                config.markModified('value');
                await config.save();
            }
        }
        revalidatePath('/settings');
        revalidatePath('/inventory');
        return { success: true };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function removeUnitType(type: string): Promise<{ success: boolean; message?: string }> {
    try {
        await requireSession();
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }
    await dbConnect();
    try {
        const config = await Configuration.findOne({ key: 'unit_types' });
        if (config) {
            const types = config.value as string[];
            const newTypes = types.filter(t => t !== type);
            config.value = newTypes;
            config.markModified('value');
            await config.save();
        }
        revalidatePath('/settings');
        revalidatePath('/inventory');
        return { success: true };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

// ==================== PRODUCT TYPES & EXPENSE CATEGORIES ====================

import { DEFAULT_PRODUCT_TYPES, DEFAULT_EXPENSE_CATEGORIES, ProductTypeCatalog } from '@/types';

function getDefaultProductTypeCatalog(): ProductTypeCatalog {
    return {
        CHORIZO: DEFAULT_CHORIZO_TYPES.map(normalizeConfigName),
        'MATERIA PRIMA': [],
        'MAQUINARIA Y EQUIPOS': [],
    };
}

export async function getProductTypes(): Promise<string[]> {
    await dbConnect();
    try {
        let config = await Configuration.findOne({ key: 'product_types' });

        if (!config) {
            config = await Configuration.create({ key: 'product_types', value: DEFAULT_PRODUCT_TYPES });
        }

        const normalizedTypes = (config.value as string[]).map(normalizeConfigName);
        if (JSON.stringify(config.value) !== JSON.stringify(normalizedTypes)) {
            config.value = normalizedTypes;
            config.markModified('value');
            await config.save();
        }

        return normalizedTypes;
    } catch (error) {
        console.error("Error fetching product types:", error);
        return DEFAULT_PRODUCT_TYPES.map(normalizeConfigName);
    }
}

export async function getProductTypeCatalog(): Promise<ProductTypeCatalog> {
    await dbConnect();
    try {
        const [types, chorizoTypes] = await Promise.all([
            getProductTypes(),
            getChorizoTypes(),
        ]);

        let config = await Configuration.findOne({ key: 'product_type_catalog' });
        if (!config) {
            const initialCatalog = getDefaultProductTypeCatalog();
            initialCatalog.CHORIZO = chorizoTypes;
            for (const type of types) {
                initialCatalog[type] = initialCatalog[type] || [];
            }
            config = await Configuration.create({ key: 'product_type_catalog', value: initialCatalog });
        }

        const rawCatalog = (config.value || {}) as ProductTypeCatalog;
        const catalog: ProductTypeCatalog = {};
        for (const [category, productNames] of Object.entries(rawCatalog)) {
            catalog[normalizeConfigName(category)] = (productNames || []).map(normalizeConfigName);
        }
        let changed = false;
        for (const type of types) {
            if (!catalog[type]) {
                catalog[type] = type === 'CHORIZO' ? chorizoTypes : [];
                changed = true;
            }
        }
        if (catalog.CHORIZO && chorizoTypes.some(type => !catalog.CHORIZO.includes(type))) {
            catalog.CHORIZO = Array.from(new Set([...catalog.CHORIZO, ...chorizoTypes]));
            changed = true;
        }
        if (changed || JSON.stringify(rawCatalog) !== JSON.stringify(catalog)) {
            config.value = catalog;
            config.markModified('value');
            await config.save();
        }

        return catalog;
    } catch (error) {
        console.error("Error fetching product type catalog:", error);
        return getDefaultProductTypeCatalog();
    }
}

export async function addProductType(type: string): Promise<{ success: boolean; message?: string }> {
    try {
        await requireSession();
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }
    await dbConnect();
    try {
        const normalizedType = normalizeConfigName(type);
        const config = await Configuration.findOne({ key: 'product_types' });
        if (!config) {
            await Configuration.create({ key: 'product_types', value: [...DEFAULT_PRODUCT_TYPES.map(normalizeConfigName), normalizedType] });
        } else {
            const types = (config.value as string[]).map(normalizeConfigName);
            if (!types.includes(normalizedType)) {
                types.push(normalizedType);
                config.value = types;
                config.markModified('value');
                await config.save();
            }
        }
        const catalogConfig = await Configuration.findOne({ key: 'product_type_catalog' });
        if (catalogConfig) {
            const catalog = (catalogConfig.value || {}) as ProductTypeCatalog;
            catalog[normalizedType] = catalog[normalizedType] || [];
            catalogConfig.value = catalog;
            catalogConfig.markModified('value');
            await catalogConfig.save();
        }
        revalidatePath('/settings');
        revalidatePath('/inventory');
        return { success: true };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function removeProductType(type: string): Promise<{ success: boolean; message?: string }> {
    try {
        await requireSession();
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }
    await dbConnect();
    try {
        const config = await Configuration.findOne({ key: 'product_types' });
        if (config) {
            const normalizedType = normalizeConfigName(type);
            const types = (config.value as string[]).map(normalizeConfigName);
            const newTypes = types.filter(t => t !== normalizedType);
            config.value = newTypes;
            config.markModified('value');
            await config.save();
        }
        const catalogConfig = await Configuration.findOne({ key: 'product_type_catalog' });
        if (catalogConfig) {
            const catalog = (catalogConfig.value || {}) as ProductTypeCatalog;
            delete catalog[normalizeConfigName(type)];
            catalogConfig.value = catalog;
            catalogConfig.markModified('value');
            await catalogConfig.save();
        }
        revalidatePath('/settings');
        revalidatePath('/inventory');
        return { success: true };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function addProductNameToCategory(category: string, productName: string): Promise<{ success: boolean; message?: string }> {
    try {
        await requireSession();
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }
    await dbConnect();
    try {
        const cleanCategory = normalizeConfigName(category);
        const cleanName = normalizeConfigName(productName);
        if (!cleanCategory || !cleanName) return { success: false, message: "Categoría y tipo de producto son requeridos" };

        let config = await Configuration.findOne({ key: 'product_type_catalog' });
        if (!config) {
            config = await Configuration.create({ key: 'product_type_catalog', value: await getProductTypeCatalog() });
        }

        const catalog = (config.value || {}) as ProductTypeCatalog;
        catalog[cleanCategory] = catalog[cleanCategory] || [];
        if (!catalog[cleanCategory].includes(cleanName)) {
            catalog[cleanCategory].push(cleanName);
        }
        config.value = catalog;
        config.markModified('value');
        await config.save();

        if (cleanCategory === 'CHORIZO') {
            await addChorizoType(cleanName);
        }

        revalidatePath('/settings');
        revalidatePath('/inventory');
        return { success: true };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function removeProductNameFromCategory(category: string, productName: string): Promise<{ success: boolean; message?: string }> {
    try {
        await requireSession();
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }
    await dbConnect();
    try {
        const config = await Configuration.findOne({ key: 'product_type_catalog' });
        if (config) {
            const catalog = (config.value || {}) as ProductTypeCatalog;
            const cleanCategory = normalizeConfigName(category);
            const cleanName = normalizeConfigName(productName);
            catalog[cleanCategory] = (catalog[cleanCategory] || []).map(normalizeConfigName).filter(item => item !== cleanName);
            config.value = catalog;
            config.markModified('value');
            await config.save();
        }

        if (normalizeConfigName(category) === 'CHORIZO') {
            await removeChorizoType(productName);
        }

        revalidatePath('/settings');
        revalidatePath('/inventory');
        return { success: true };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function getExpenseCategories(): Promise<string[]> {
    await dbConnect();
    try {
        let config = await Configuration.findOne({ key: 'expense_categories' });

        if (!config) {
            config = await Configuration.create({ key: 'expense_categories', value: DEFAULT_EXPENSE_CATEGORIES });
        }

        return config.value as string[];
    } catch (error) {
        console.error("Error fetching expense categories:", error);
        return DEFAULT_EXPENSE_CATEGORIES;
    }
}

export async function addExpenseCategory(category: string): Promise<{ success: boolean; message?: string }> {
    try {
        await requireSession();
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }
    await dbConnect();
    try {
        const config = await Configuration.findOne({ key: 'expense_categories' });
        if (!config) {
            await Configuration.create({ key: 'expense_categories', value: [...DEFAULT_EXPENSE_CATEGORIES, category] });
        } else {
            const categories = config.value as string[];
            if (!categories.includes(category)) {
                categories.push(category);
                config.value = categories;
                config.markModified('value');
                await config.save();
            }
        }
        revalidatePath('/settings');
        revalidatePath('/expenses');
        return { success: true };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function removeExpenseCategory(category: string): Promise<{ success: boolean; message?: string }> {
    try {
        await requireSession();
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }
    await dbConnect();
    try {
        const config = await Configuration.findOne({ key: 'expense_categories' });
        if (config) {
            const categories = config.value as string[];
            const newCategories = categories.filter(c => c !== category);
            config.value = newCategories;
            config.markModified('value');
            await config.save();
        }
        revalidatePath('/settings');
        revalidatePath('/expenses');
        return { success: true };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function getNCFSequences(): Promise<{ type: string; currentValue: number }[]> {
    await dbConnect();
    try {
        // Ensure standard types exist (Tradicionales + Electrónicos)
        const standardTypes = [
            // Tradicionales
            'B01', 'B02', 'B04', 'B14', 'B15',
            // Electrónicos (e-NCF) — Según Informe Técnico e-CF v1.0 DGII
            'E31', 'E32', 'E33', 'E34', 'E41', 'E43', 'E44', 'E45', 'E46', 'E47',
        ];

        for (const type of standardTypes) {
            const exists = await Sequence.findOne({ type });
            if (!exists) {
                await Sequence.create({ type, currentValue: 0 });
            }
        }

        const sequences = await Sequence.find({}).sort({ type: 1 }).lean();
        return sequences.map(s => ({ type: s.type, currentValue: s.currentValue }));
    } catch (error) {
        console.error("Error fetching sequences:", error);
        return [];
    }
}

export async function updateNCFSequence(type: string, newValue: number): Promise<{ success: boolean; message?: string }> {
    try {
        await requireRole(['Administrador']);
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }
    await dbConnect();
    try {
        await Sequence.findOneAndUpdate(
            { type },
            { currentValue: newValue },
            { upsert: true, new: true }
        );
        revalidatePath('/settings');
        return { success: true };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

// Helper for other actions to get next NCF (tradicional)
export async function getNextNCF(type: string, session?: object): Promise<string> {
    await dbConnect();
    const sequence = await Sequence.findOneAndUpdate(
        { type },
        { $inc: { currentValue: 1 } },
        { upsert: true, new: true, session: session as any }
    );

    const paddedSequence = String(sequence.currentValue).padStart(8, '0');
    return `${type}${paddedSequence}`;
}

// Helper for e-NCF (Electrónicos) — formato: E31 (3 chars) + 10 dígitos secuencia = 13 chars total
export async function getNextENCF(type: string, session?: object): Promise<string> {
    await dbConnect();
    const sequence = await Sequence.findOneAndUpdate(
        { type },
        { $inc: { currentValue: 1 } },
        { upsert: true, new: true, session: session as any }
    );

    // e-NCF format: tipo (3 chars) + sequence (10 digits)
    // Ejemplo: E31 + 0000000001 = E310000000001 (13 chars total)
    const paddedSequence = String(sequence.currentValue).padStart(10, '0');
    return `${type}${paddedSequence}`;
}

export async function syncNCFSequences(options?: { skipAuth?: boolean }): Promise<{ success: boolean; message?: string }> {
    if (!options?.skipAuth) {
        try {
            await requireRole(['Administrador']);
        } catch (error) {
            return { success: false, message: getAuthErrorMessage(error) };
        }
    }
    await dbConnect();
    try {
        // Tradicionales
        const traditionalTypes = ['B01', 'B02', 'B04', 'B14', 'B15'];
        // Electrónicos
        const electronicTypes = ['E31', 'E32', 'E33', 'E34', 'E41', 'E43', 'E44', 'E45', 'E46', 'E47'];
        let updatedCount = 0;

        // Sync tradicionales — buscar en campo 'ncf'
        for (const type of traditionalTypes) {
            const latestInvoice = await InvoiceModel.findOne({
                ncf: { $regex: new RegExp(`^${type}`) }
            }).sort({ ncf: -1 });

            if (latestInvoice && latestInvoice.ncf) {
                // B01 + 8 dígitos → substring(3) = los 8 dígitos
                const sequencePart = latestInvoice.ncf.substring(3);
                const maxSequence = parseInt(sequencePart, 10);

                if (!isNaN(maxSequence)) {
                    await Sequence.findOneAndUpdate(
                        { type },
                        { currentValue: maxSequence },
                        { upsert: true, new: true }
                    );
                    updatedCount++;
                }
            } else {
                const currentSeq = await Sequence.findOne({ type });
                if (currentSeq && currentSeq.currentValue !== 0) {
                    await Sequence.findOneAndUpdate(
                        { type },
                        { currentValue: 0 },
                        { upsert: true, new: true }
                    );
                    updatedCount++;
                }
            }
        }

        // Sync electrónicos — buscar en campo 'ncf' (que almacena el e-NCF al crear)
        for (const type of electronicTypes) {
            const latestInvoice = await InvoiceModel.findOne({
                ncf: { $regex: new RegExp(`^${type}`) }
            }).sort({ ncf: -1 });

            if (latestInvoice && latestInvoice.ncf) {
                // E31 + 10 dígitos → substring(3) = los 10 dígitos
                const sequencePart = latestInvoice.ncf.substring(3);
                const maxSequence = parseInt(sequencePart, 10);

                if (!isNaN(maxSequence)) {
                    await Sequence.findOneAndUpdate(
                        { type },
                        { currentValue: maxSequence },
                        { upsert: true, new: true }
                    );
                    updatedCount++;
                }
            }
        }

        if (updatedCount > 0) {
            revalidatePath('/settings');
        }

        return { success: true, message: `Sincronizadas ${updatedCount} secuencias` };
    } catch (error: any) {
        console.error("Error syncing NCF sequences:", error);
        return { success: false, message: error.message };
    }
}

// ==================== USERS ====================

export async function getUsers() {
    try {
        await requireRole(['Administrador']);
    } catch {
        return [];
    }
    await dbConnect();
    try {
        const users = await User.find({}).sort({ createdAt: -1 }).lean();
        return users.map(u => ({
            id: u._id.toString(),
            name: u.name,
            username: u.username || u.email?.split('@')[0] || '',
            email: u.email,
            role: mapRoleFromDb(u.role),
            status: u.status,
            mustChangePassword: Boolean(u.mustChangePassword),
            createdAt: u.createdAt.toISOString()
        }));
    } catch (error) {
        return [];
    }
}

function buildInitialPassword(name: string) {
    const firstName = name.trim().split(/\s+/)[0] || 'user';
    const base = firstName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 4)
        .toLowerCase() || 'user';

    return `${base}123`;
}

function normalizeUsernamePart(value: string) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toLowerCase();
}

async function buildUniqueUsername(name: string) {
    const parts = name.trim().split(/\s+/).map(normalizeUsernamePart).filter(Boolean);
    const first = parts[0] || 'usuario';
    const last = parts.length > 1 ? parts[parts.length - 1] : '';
    const base = last ? `${first}.${last}` : first;

    let candidate = base;
    let suffix = 2;

    while (await User.exists({ username: candidate })) {
        candidate = `${base}${suffix}`;
        suffix += 1;
    }

    return candidate;
}

export async function createUser(data: { name: string; email: string; role: string }) {
    try {
        await requireRole(['Administrador']);
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }
    await dbConnect();
    try {
        const initialPassword = buildInitialPassword(data.name);
        const hashedPassword = await bcrypt.hash(initialPassword, 10);
        const username = await buildUniqueUsername(data.name);
        const email = data.email.trim().toLowerCase();

        await User.create({
            name: data.name.trim(),
            username,
            email: email || undefined,
            password: hashedPassword,
            role: mapRoleToDb(data.role),
            status: 'Activo',
            mustChangePassword: true
        });
        revalidatePath('/settings');
        return { success: true, initialPassword, username };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function deleteUser(id: string) {
    try {
        await requireRole(['Administrador']);
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }
    await dbConnect();
    try {
        await User.findByIdAndDelete(id);
        revalidatePath('/settings');
        return { success: true };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}
