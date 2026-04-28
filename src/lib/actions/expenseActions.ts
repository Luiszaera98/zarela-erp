"use server";

import dbConnect from '@/lib/db';
import { Expense as ExpenseModel, RecurringExpense as RecurringExpenseModel, ExpenseTransaction as ExpenseTransactionModel } from '@/models';
import { Expense, RecurringExpense } from '@/types';
import { revalidatePath } from 'next/cache';
import mongoose from 'mongoose';
import { addWeeks, addMonths, addYears, isBefore, setDate } from 'date-fns';
import { getAuthErrorMessage, requireRole } from '@/lib/auth/session';

// Helper to convert MongoDB document to Expense type
function mapExpense(doc: any): Expense {
    return {
        id: doc._id.toString(),
        description: doc.description,
        amount: doc.amount,
        date: doc.date.toISOString(),
        category: doc.category,
        supplierName: doc.supplier,
        supplierRnc: doc.supplierRnc,
        invoiceNumber: doc.invoiceNumber,
        paymentMethod: doc.paymentMethod,
        reference: doc.reference,
        status: doc.status,
        paidAmount: doc.paidAmount || 0,
        lastPaymentDate: doc.lastPaymentDate ? doc.lastPaymentDate.toISOString() : undefined,
        notes: doc.notes,
        attachments: doc.attachments || [],
        ncf: doc.ncf,
        ncfType: doc.ncfType,
        encf: doc.encf,
        ecfStatus: doc.ecfStatus,
        ecfTrackId: doc.ecfTrackId,
        ecfSignedXml: doc.ecfSignedXml,
        ecfFechaFirma: doc.ecfFechaFirma,
        ecfCodigoSeguridad: doc.ecfCodigoSeguridad,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
    };
}

// Helper to convert MongoDB document to RecurringExpense type
function mapRecurringExpense(doc: any): RecurringExpense {
    return {
        id: doc._id.toString(),
        description: doc.description,
        category: doc.category,
        amount: doc.amount,
        supplier: doc.supplier,
        frequency: doc.frequency,
        dayOfMonth: doc.dayOfMonth,
        nextRun: doc.nextRun.toISOString(),
        active: doc.active,
        lastGenerated: doc.lastGenerated?.toISOString(),
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
    };
}

export async function checkAndGenerateRecurringExpenses(): Promise<void> {
    await dbConnect();
    const now = new Date();

    try {
        // Find active recurring expenses due for generation
        const dueExpenses = await RecurringExpenseModel.find({
            active: true,
            nextRun: { $lte: now }
        });

        for (const recurring of dueExpenses) {
            // Create the expense
            await ExpenseModel.create({
                description: recurring.description,
                category: recurring.category,
                amount: recurring.amount,
                date: now,
                supplier: recurring.supplier,
                paymentMethod: 'Efectivo', // Default
                status: 'Pendiente',
                paidAmount: 0,
                notes: `Generado automáticamente - Recurrente: ${recurring.frequency}`
            });

            // Calculate next run
            let nextDate = new Date(recurring.nextRun);

            // Advance one cycle
            switch (recurring.frequency) {
                case 'Semanal': nextDate = addWeeks(nextDate, 1); break;
                case 'Quincenal': nextDate = addWeeks(nextDate, 2); break;
                case 'Mensual': nextDate = addMonths(nextDate, 1); break;
                case 'Anual': nextDate = addYears(nextDate, 1); break;
            }

            // Catch up logic: if nextDate is still in the past (missed multiple cycles), reset to future
            if (isBefore(nextDate, now)) {
                nextDate = new Date();
                switch (recurring.frequency) {
                    case 'Semanal': nextDate = addWeeks(nextDate, 1); break;
                    case 'Quincenal': nextDate = addWeeks(nextDate, 2); break;
                    case 'Mensual': nextDate = addMonths(nextDate, 1); break;
                    case 'Anual': nextDate = addYears(nextDate, 1); break;
                }
                // If dayOfMonth is set for Monthly, try to respect it
                if (recurring.frequency === 'Mensual' && recurring.dayOfMonth) {
                    const targetDay = recurring.dayOfMonth;
                    nextDate = setDate(nextDate, targetDay);
                    // If setting the day puts us back in the past (e.g. today is 15th, target is 5th), move to next month
                    if (isBefore(nextDate, now)) {
                        nextDate = addMonths(nextDate, 1);
                    }
                }
            }

            await RecurringExpenseModel.findByIdAndUpdate(recurring._id, {
                nextRun: nextDate,
                lastGenerated: now
            });
        }

        if (dueExpenses.length > 0) {
            revalidatePath('/expenses');
        }
    } catch (error) {
        console.error("Error generating recurring expenses:", error);
    }
}

// Helper to map transaction (Optional, if we want strict typing)
function mapExpenseTransaction(doc: any) {
    return {
        id: doc._id.toString(),
        expenseId: doc.expenseId,
        amount: doc.amount,
        paymentMethod: doc.paymentMethod,
        date: doc.date instanceof Date ? doc.date.toISOString() : doc.date,
        notes: doc.notes,
        createdAt: doc.createdAt.toISOString()
    };
}

export async function getExpenseTransactions(month?: string, year?: string, timezoneOffset?: number): Promise<any[]> {
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

        const transactions = await ExpenseTransactionModel.find(query).sort({ date: -1 }).lean();

        // Enrich with expense details (description, supplier) if possible
        // Ideally we would populate, but for now we'll do it purely
        const enriched = await Promise.all(transactions.map(async (t: any) => {
            const expense = await ExpenseModel.findById(t.expenseId).select('description supplier category invoiceNumber').lean();
            return {
                ...mapExpenseTransaction(t),
                attachments: t.attachments || [],
                expenseDescription: expense?.description || 'Gasto Eliminado',
                expenseSupplier: expense?.supplier || '',
                expenseCategory: expense?.category || '',
                expenseInvoiceNumber: expense?.invoiceNumber || ''
            };
        }));

        return enriched;
    } catch (error) {
        console.error("Error fetching expense transactions:", error);
        return [];
    }
}

export async function getMonthlyExpenseTotal(
    month: string,
    year: string,
    timezoneOffset: number = 0
): Promise<number> {
    await dbConnect();
    try {
        const offsetMs = (timezoneOffset || 0) * 60 * 1000;
        const startUTC = Date.UTC(parseInt(year), parseInt(month), 1);
        const startDate = new Date(startUTC + offsetMs);
        const endUTC = Date.UTC(parseInt(year), parseInt(month) + 1, 0, 23, 59, 59, 999);
        const endDate = new Date(endUTC + offsetMs);

        const result = await ExpenseModel.aggregate([
            {
                $match: {
                    date: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$amount" }
                }
            }
        ]);

        return result.length > 0 ? result[0].total : 0;
    } catch (error) {
        console.error("Error fetching monthly expense total:", error);
        return 0;
    }
}

export async function getExpenses(
    month?: string,
    year?: string,
    timezoneOffset: number = 0,
    page: number = 1,
    limit: number = 25,
    statusFilter: string = 'Todos',
    category: string = 'Todos',
    search: string = ''
): Promise<{ expenses: Expense[]; total: number; totalPages: number }> {
    await dbConnect();
    // Check for recurring expenses generation on load
    await checkAndGenerateRecurringExpenses();

    try {
        let query: any = {};

        // Status Filter Logic
        if (statusFilter !== 'Todos') {
            query.status = statusFilter;
        }

        // Category Filter Logic
        if (category !== 'Todos') {
            query.category = category;
        }

        // Search Logic
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            query.$or = [
                { description: searchRegex },
                { supplier: searchRegex },
                { invoiceNumber: searchRegex }
            ];
        }

        // Date Logic
        // If filtering by Pendiente or Parcial, ignore the date range (showing global debt)
        const ignoreDate = (statusFilter === 'Pendiente' || statusFilter === 'Parcial');

        if (month && year && !ignoreDate) {
            const offsetMs = (timezoneOffset || 0) * 60 * 1000;

            // Start of month in UTC
            const startUTC = Date.UTC(parseInt(year), parseInt(month), 1);
            const startDate = new Date(startUTC + offsetMs);

            // End of month in UTC
            const endUTC = Date.UTC(parseInt(year), parseInt(month) + 1, 0, 23, 59, 59, 999);
            const endDate = new Date(endUTC + offsetMs);

            query.date = { $gte: startDate, $lte: endDate };
        }

        const skip = (page - 1) * limit;

        const [expenses, total] = await Promise.all([
            ExpenseModel.find(query)
                .sort({ date: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            ExpenseModel.countDocuments(query)
        ]);

        return {
            expenses: expenses.map(mapExpense),
            total,
            totalPages: Math.ceil(total / limit)
        };
    } catch (error) {
        console.error("Error fetching expenses:", error);
        return { expenses: [], total: 0, totalPages: 0 };
    }
}

// Helper to parse dates strictly preventing timezone shifts
function parseSafeDate(dateInput: string | Date | undefined): Date {
    if (!dateInput) return new Date();
    if (dateInput instanceof Date) return dateInput;
    // If string YYYY-MM-DD, append T12:00:00 to force noon local/UTC balance
    if (typeof dateInput === 'string' && !dateInput.includes('T')) {
        return new Date(`${dateInput}T12:00:00`);
    }
    return new Date(dateInput);
}

// ... (keep mapExpense, mapRecurringExpense, checkAndGenerateRecurringExpenses, mapExpenseTransaction, getExpenseTransactions, getMonthlyExpenseTotal, getExpenses)

export async function createExpense(data: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ success: boolean; expense?: Expense; message?: string }> {
    try {
        await requireRole(['Administrador']);
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }
    await dbConnect();
    try {
        const paidAmount = data.status === 'Pagada' ? data.amount : (data.paidAmount || 0);
        const safeDate = parseSafeDate(data.date);

        const newExpense = await ExpenseModel.create({
            description: data.description,
            category: data.category,
            amount: data.amount,
            date: safeDate,
            supplier: data.supplierName,
            supplierRnc: data.supplierRnc,
            invoiceNumber: data.invoiceNumber,
            paymentMethod: data.paymentMethod || 'Efectivo',
            reference: data.reference,
            status: data.status,
            paidAmount: paidAmount,
            notes: data.notes,
            attachments: data.attachments || [],
            ncf: data.ncf,
            ncfType: data.ncfType,
        });

        // If created as 'Pagada', create a transaction record to reflect the payment
        if (data.status === 'Pagada') {
            await ExpenseTransactionModel.create({
                expenseId: newExpense._id.toString(),
                amount: data.amount,
                paymentMethod: data.paymentMethod || 'Efectivo',
                date: safeDate,
                notes: data.notes,
                attachments: data.attachments || []
            });
        }

        revalidatePath('/expenses');
        return { success: true, expense: mapExpense(newExpense) };
    } catch (error: any) {
        console.error("Error creating expense:", error);
        return { success: false, message: error.message || "Error al crear gasto" };
    }
}

export async function updateExpense(id: string, data: Partial<Expense>): Promise<{ success: boolean; expense?: Expense; message?: string }> {
    try {
        await requireRole(['Administrador']);
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }
    await dbConnect();
    try {
        const updateData: any = {
            description: data.description,
            category: data.category,
            amount: data.amount,
            supplier: data.supplierName,
            supplierRnc: data.supplierRnc,
            invoiceNumber: data.invoiceNumber,
            paymentMethod: data.paymentMethod,
            reference: data.reference,
            status: data.status,
            paidAmount: data.paidAmount,
            notes: data.notes,
            ncf: data.ncf,
            ncfType: data.ncfType,
        };

        // If ncfType is changed to an electronic type, ensure ecfStatus is set if not already present
        if (data.ncfType?.startsWith('E')) {
            const currentDoc = await ExpenseModel.findById(id);
            if (currentDoc && !currentDoc.ecfStatus) {
                updateData.ecfStatus = 'Pendiente';
            }
        }

        if (data.date) {
            updateData.date = parseSafeDate(data.date);
        }

        // Logic to maintain consistency between status and paidAmount
        if (data.status === 'Pendiente') {
            updateData.paidAmount = 0;
        } else if (data.status === 'Pagada') {
            // If changing to Pagada, we need the full amount. 
            // If amount is in updateData, use it. Otherwise, we need to fetch the document.
            if (updateData.amount) {
                updateData.paidAmount = updateData.amount;
            } else {
                const currentDoc = await ExpenseModel.findById(id);
                if (currentDoc) {
                    updateData.paidAmount = currentDoc.amount;
                }
            }
        }

        Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

        const updatedExpense = await ExpenseModel.findByIdAndUpdate(id, updateData, { new: true });

        if (!updatedExpense) {
            return { success: false, message: "Gasto no encontrado" };
        }

        revalidatePath('/expenses');
        return { success: true, expense: mapExpense(updatedExpense) };
    } catch (error: any) {
        console.error("Error updating expense:", error);
        return { success: false, message: error.message || "Error al actualizar gasto" };
    }
}

export async function registerExpensePayment(id: string, amount: number, paymentMethod: string, date: string, attachments?: string[]): Promise<{ success: boolean; message?: string }> {
    try {
        await requireRole(['Administrador']);
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }
    await dbConnect();
    try {
        const expense = await ExpenseModel.findById(id);
        if (!expense) {
            return { success: false, message: "Gasto no encontrado" };
        }

        const safeDate = parseSafeDate(date);

        // Create transaction record
        await ExpenseTransactionModel.create({
            expenseId: id,
            amount: amount,
            paymentMethod: paymentMethod,
            date: safeDate,
            attachments: attachments || []
        });

        const newPaidAmount = (expense.paidAmount || 0) + amount;
        let newStatus = expense.status;

        if (newPaidAmount >= expense.amount - 0.01) {
            newStatus = 'Pagada';
        } else if (newPaidAmount > 0) {
            newStatus = 'Parcial';
        }

        await ExpenseModel.findByIdAndUpdate(id, {
            paidAmount: newPaidAmount,
            status: newStatus,
            paymentMethod: paymentMethod,
            lastPaymentDate: safeDate,
        });

        revalidatePath('/expenses');
        return { success: true };
    } catch (error: any) {
        console.error("Error registering expense payment:", error);
        return { success: false, message: error.message || "Error al registrar pago" };
    }
}

export async function deleteExpenseAction(id: string): Promise<{ success: boolean; message?: string }> {
    try {
        await requireRole(['Administrador']);
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }
    await dbConnect();
    try {
        const result = await ExpenseModel.findByIdAndDelete(id);
        if (!result) {
            return { success: false, message: "Gasto no encontrado" };
        }

        // Cascade delete transactions
        await ExpenseTransactionModel.deleteMany({ expenseId: id });

        revalidatePath('/expenses');
        return { success: true };
    } catch (error: any) {
        console.error("Error deleting expense:", error);
        return { success: false, message: error.message || "Error al eliminar gasto" };
    }
}

export async function updateExpenseTransaction(id: string, data: { amount: number; paymentMethod: string; date: string; notes?: string }): Promise<{ success: boolean; message?: string }> {
    try {
        await requireRole(['Administrador']);
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }
    await dbConnect();
    try {
        const transaction = await ExpenseTransactionModel.findById(id);
        if (!transaction) return { success: false, message: "Transacción no encontrada" };

        const expense = await ExpenseModel.findById(transaction.expenseId);
        if (!expense) return { success: false, message: "Gasto asociado no encontrado" };

        // Calculate new paid amount
        let newPaidAmount = (expense.paidAmount || 0) - transaction.amount + data.amount;
        if (newPaidAmount < 0) newPaidAmount = 0;

        // Determine new status
        let newStatus = expense.status;
        if (newPaidAmount >= expense.amount - 0.01) {
            newStatus = 'Pagada';
        } else if (newPaidAmount > 0) {
            newStatus = 'Parcial';
        } else {
            newStatus = 'Pendiente';
        }

        // Update Experiment
        await ExpenseModel.findByIdAndUpdate(expense._id, {
            paidAmount: newPaidAmount,
            status: newStatus,
        });

        const safeDate = parseSafeDate(data.date);

        // Update Transaction
        await ExpenseTransactionModel.findByIdAndUpdate(id, {
            amount: data.amount,
            paymentMethod: data.paymentMethod,
            date: safeDate,
            notes: data.notes
        });

        revalidatePath('/expenses');
        return { success: true };

    } catch (error: any) {
        console.error("Error updating expense transaction:", error);
        return { success: false, message: error.message || "Error al actualizar transacción" };
    }
}

export async function deleteExpenseTransaction(id: string): Promise<{ success: boolean; message?: string }> {
    try {
        await requireRole(['Administrador']);
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }
    await dbConnect();
    try {
        const transaction = await ExpenseTransactionModel.findById(id);
        if (!transaction) return { success: false, message: "Transacción no encontrada" };

        const expense = await ExpenseModel.findById(transaction.expenseId);
        if (!expense) {
            // If expense doesn't exist, just delete the orphan transaction
            await ExpenseTransactionModel.findByIdAndDelete(id);
            return { success: true };
        }

        // Revert paid amount
        let newPaidAmount = (expense.paidAmount || 0) - transaction.amount;
        if (newPaidAmount < 0) newPaidAmount = 0;

        // Recalculate status
        let newStatus = expense.status;
        if (newPaidAmount >= expense.amount - 0.01) {
            newStatus = 'Pagada';
        } else if (newPaidAmount > 0) {
            newStatus = 'Parcial';
        } else {
            newStatus = 'Pendiente';
        }

        await ExpenseModel.findByIdAndUpdate(expense._id, {
            paidAmount: newPaidAmount,
            status: newStatus
        });

        await ExpenseTransactionModel.findByIdAndDelete(id);

        revalidatePath('/expenses');
        return { success: true };

    } catch (error: any) {
        console.error("Error deleting expense transaction:", error);
        return { success: false, message: error.message || "Error al eliminar transacción" };
    }
}

// ==================== RECURRING EXPENSE ACTIONS ====================

export async function getRecurringExpenses(): Promise<RecurringExpense[]> {
    await dbConnect();
    try {
        const expenses = await RecurringExpenseModel.find({}).sort({ createdAt: -1 }).lean();
        return expenses.map(mapRecurringExpense);
    } catch (error) {
        console.error("Error fetching recurring expenses:", error);
        return [];
    }
}

export async function createRecurringExpense(data: Omit<RecurringExpense, 'id' | 'createdAt' | 'updatedAt' | 'lastGenerated'>): Promise<{ success: boolean; expense?: RecurringExpense; message?: string }> {
    try {
        await requireRole(['Administrador']);
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error) };
    }
    await dbConnect();
    try {
        const newExpense = await RecurringExpenseModel.create({
            description: data.description,
            category: data.category,
            amount: data.amount,
            supplier: data.supplier,
            frequency: data.frequency,
            dayOfMonth: data.dayOfMonth,
            nextRun: data.nextRun,
            active: data.active
        });

        revalidatePath('/expenses');
        return { success: true, expense: mapRecurringExpense(newExpense) };
    } catch (error: any) {
        console.error("Error creating recurring expense:", error);
        return { success: false, message: error.message || "Error al crear gasto recurrente" };
    }
}

export async function toggleRecurringExpense(id: string, active: boolean): Promise<{ success: boolean }> {
    try {
        await requireRole(['Administrador']);
    } catch {
        return { success: false };
    }
    await dbConnect();
    try {
        await RecurringExpenseModel.findByIdAndUpdate(id, { active });
        revalidatePath('/expenses');
        return { success: true };
    } catch (error) {
        console.error("Error toggling recurring expense:", error);
        return { success: false };
    }
}

export async function deleteRecurringExpense(id: string): Promise<{ success: boolean }> {
    try {
        await requireRole(['Administrador']);
    } catch {
        return { success: false };
    }
    await dbConnect();
    try {
        await RecurringExpenseModel.findByIdAndDelete(id);
        revalidatePath('/expenses');
        return { success: true };
    } catch (error) {
        console.error("Error deleting recurring expense:", error);
        return { success: false };
    }
}
