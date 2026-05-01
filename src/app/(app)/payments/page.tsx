"use client";

import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, DollarSign, Download, ArrowDownLeft, ArrowUpRight, FileText, Calendar, Pencil, MoreHorizontal, Trash, Eye, Paperclip } from 'lucide-react';
import { getAllPayments, deletePayment } from '@/lib/actions/paymentActions';
import { getExpenseTransactions, deleteExpenseTransaction, getMonthlyExpenseTotal } from '@/lib/actions/expenseActions';
import { Payment, CreditNote } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MonthPicker } from '@/components/ui/month-picker';
import { EditPaymentDialog } from '@/components/payments/edit-payment-dialog';
import { EditExpensePaymentDialog } from '@/components/expenses/edit-expense-payment-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Transaction =
    | (Payment & { type: 'payment' })
    | (CreditNote & { type: 'creditNote' })
    | {
        id: string;
        type: 'expense_payment';
        amount: number;
        date: string;
        createdAt?: string;
        paymentMethod: string;
        expenseDescription: string;
        expenseSupplier: string;
        expenseCategory: string;
        notes?: string;
        attachments?: string[];
    };

export default function TransactionsHistoryPage() {
    const { toast } = useToast();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [totalRegisteredExpenses, setTotalRegisteredExpenses] = useState(0);

    const currentDate = new Date();
    const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth().toString());
    const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear().toString());

    // Pagination State
    const [page, setPage] = useState(1);
    const ITEMS_PER_PAGE = 25;

    // Edit Dialog States
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

    const [isEditExpenseDialogOpen, setIsEditExpenseDialogOpen] = useState(false);
    const [selectedExpensePayment, setSelectedExpensePayment] = useState<any | null>(null);

    // Delete Confirmation State
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleteType, setDeleteType] = useState<'payment' | 'expense_payment' | null>(null);
    const [deleteAmount, setDeleteAmount] = useState<number>(0);

    // Attachment Preview State
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    useEffect(() => {
        setPage(1);
        fetchTransactions();
    }, [selectedMonth, selectedYear]);

    const fetchTransactions = async () => {
        setIsLoading(true);
        try {
            const offset = new Date().getTimezoneOffset();
            // Use getMonthlyExpenseTotal instead of getExpenses (which is now paginated)
            const [paymentsData, expensePaymentsData, totalExpensesAmount] = await Promise.all([
                getAllPayments(selectedMonth, selectedYear),
                getExpenseTransactions(selectedMonth, selectedYear, offset),
                getMonthlyExpenseTotal(selectedMonth, selectedYear, offset)
            ]);

            const combined: Transaction[] = [
                ...paymentsData.map(p => ({ ...p, type: 'payment' as const })),
                ...expensePaymentsData.map(e => ({
                    ...e,
                    type: 'expense_payment' as const
                }))
            ];

            // Sort by creation date first so new payments show at the top immediately.
            combined.sort((a, b) => {
                const createdAtA = new Date(a.createdAt || (a.type === 'payment' ? a.paymentDate : a.date)).getTime();
                const createdAtB = new Date(b.createdAt || (b.type === 'payment' ? b.paymentDate : b.date)).getTime();

                if (createdAtA !== createdAtB) {
                    return createdAtB - createdAtA;
                }

                const dateA = new Date(a.type === 'payment' ? a.paymentDate : a.date).getTime();
                const dateB = new Date(b.type === 'payment' ? b.paymentDate : b.date).getTime();
                return dateB - dateA;
            });

            setTransactions(combined);
            setTotalRegisteredExpenses(totalExpensesAmount);
        } catch (error) {
            console.error("Failed to fetch transactions", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditPayment = (payment: Payment) => {
        setSelectedPayment(payment);
        setIsEditDialogOpen(true);
    };

    const handleEditExpensePayment = (payment: any) => {
        setSelectedExpensePayment(payment);
        setIsEditExpenseDialogOpen(true);
    };

    const confirmDelete = (id: string, type: 'payment' | 'expense_payment', amount: number) => {
        setDeleteId(id);
        setDeleteType(type);
        setDeleteAmount(amount);
    };

    const handleDelete = async () => {
        if (!deleteId || !deleteType) return;

        try {
            let result;
            if (deleteType === 'payment') {
                result = await deletePayment(deleteId);
            } else {
                result = await deleteExpenseTransaction(deleteId);
            }

            if (result.success) {
                toast({
                    title: "Transacción eliminada",
                    description: "El registro se ha eliminado correctamente del sistema.",
                });
                fetchTransactions();
            } else {
                toast({
                    title: "Error",
                    description: result.message || "No se pudo eliminar el registro",
                    variant: "destructive",
                });
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "Ocurrió un error inesperado al eliminar",
                variant: "destructive",
            });
        } finally {
            setDeleteId(null);
            setDeleteType(null);
            setDeleteAmount(0);
        }
    };

    // Filter logic
    const filteredTransactions = transactions.filter(t => {
        const searchLower = searchTerm.toLowerCase();
        if (t.type === 'payment') {
            return t.invoiceNumber.toLowerCase().includes(searchLower) ||
                t.paymentMethod.toLowerCase().includes(searchLower) ||
                (t.reference && t.reference.toLowerCase().includes(searchLower));
        } else if (t.type === 'expense_payment') {
            return t.expenseDescription.toLowerCase().includes(searchLower) ||
                t.expenseSupplier.toLowerCase().includes(searchLower) ||
                t.expenseCategory.toLowerCase().includes(searchLower);
        } else if (t.type === 'creditNote') {
            return t.ncf.toLowerCase().includes(searchLower) ||
                t.originalInvoiceNumber.toLowerCase().includes(searchLower) ||
                t.clientName.toLowerCase().includes(searchLower);
        }
        return false;
    });

    // Pagination Logic
    const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);
    const paginatedTransactions = filteredTransactions.slice(
        (page - 1) * ITEMS_PER_PAGE,
        page * ITEMS_PER_PAGE
    );

    const totalRevenue = filteredTransactions
        .filter(t => t.type === 'payment')
        .reduce((sum, t) => sum + (t as Payment).amount, 0);

    const totalExpenses = filteredTransactions
        .filter(t => t.type === 'expense_payment')
        .reduce((sum, t) => sum + (t as any).amount, 0);

    const netCashFlow = totalRevenue - totalExpenses;

    const months = [
        { value: "0", label: "Enero" },
        { value: "1", label: "Febrero" },
        { value: "2", label: "Marzo" },
        { value: "3", label: "Abril" },
        { value: "4", label: "Mayo" },
        { value: "5", label: "Junio" },
        { value: "6", label: "Julio" },
        { value: "7", label: "Agosto" },
        { value: "8", label: "Septiembre" },
        { value: "9", label: "Octubre" },
        { value: "10", label: "Noviembre" },
        { value: "11", label: "Diciembre" },
    ];

    const getPaymentMethodBadge = (method: string) => {
        const colors = {
            'Efectivo': 'bg-emerald-100 text-emerald-800 border-emerald-200',
            'Transferencia': 'bg-blue-100 text-blue-800 border-blue-200',
            'Cheque': 'bg-purple-100 text-purple-800 border-purple-200',
            'Tarjeta': 'bg-orange-100 text-orange-800 border-orange-200',
        };

        return (
            <Badge variant="outline" className={colors[method as keyof typeof colors] || 'bg-slate-100 text-slate-800 border-slate-200'}>
                {method}
            </Badge>
        );
    };

    const getTransactionView = (t: Transaction) => {
        const isEditable = t.type === 'payment' || t.type === 'expense_payment';
        const hasAttachments = t.type === 'expense_payment' && t.attachments && t.attachments.length > 0;

        if (t.type === 'payment') {
            return {
                date: t.paymentDate,
                amount: t.amount,
                badge: <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Ingreso</Badge>,
                description: <span className="text-slate-700">Factura {t.invoiceNumber} <span className="text-slate-500">{t.reference ? `(${t.reference})` : ''}</span></span>,
                category: getPaymentMethodBadge(t.paymentMethod),
                isEditable,
                hasAttachments,
            };
        }

        if (t.type === 'expense_payment') {
            return {
                date: t.date,
                amount: t.amount,
                badge: <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">Gasto</Badge>,
                description: (
                    <div className="flex items-center gap-2">
                        <span className="text-slate-700">{t.expenseDescription} <span className="text-slate-500">{t.expenseSupplier ? ` - ${t.expenseSupplier}` : ''}</span></span>
                        {hasAttachments && <Paperclip className="h-3 w-3 text-blue-500" />}
                    </div>
                ),
                category: <Badge variant="secondary" className="bg-slate-100 text-slate-600 hover:bg-slate-200">{t.expenseCategory}</Badge>,
                isEditable,
                hasAttachments,
            };
        }

        return {
            date: t.date,
            amount: t.total,
            badge: <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Nota Crédito</Badge>,
            description: <span className="text-slate-700">NCF: {t.ncf} <span className="text-slate-500">(Ref: {t.originalInvoiceNumber})</span></span>,
            category: <span className="text-sm text-slate-500">{t.reason}</span>,
            isEditable,
            hasAttachments,
        };
    };

    const renderTransactionActions = (t: Transaction, isEditable: boolean, hasAttachments?: boolean) => {
        const transactionAmount = t.type === 'payment' || t.type === 'expense_payment' ? t.amount : 0;

        return isEditable ? (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
                        <span className="sr-only">Abrir menú</span>
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    {hasAttachments && t.type === 'expense_payment' && (
                        <DropdownMenuItem onClick={() => setPreviewUrl(t.attachments?.[0] || null)}>
                            <Eye className="mr-2 h-4 w-4" />
                            <span>Ver Comprobante</span>
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => {
                        if (t.type === 'payment') handleEditPayment(t as Payment);
                        else if (t.type === 'expense_payment') handleEditExpensePayment(t);
                    }}>
                        <Pencil className="mr-2 h-4 w-4" />
                        <span>Editar</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={() => confirmDelete(t.id, t.type as 'payment' | 'expense_payment', transactionAmount)}
                        className="text-red-600 focus:text-red-600"
                    >
                        <Trash className="mr-2 h-4 w-4" />
                        <span>Eliminar</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        ) : null;
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[50vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-7xl space-y-4 rounded-xl bg-slate-50/50 p-0 min-h-screen md:space-y-8 md:p-6">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-800 md:text-4xl">Transacciones</h1>
                    <p className="mt-1 text-sm text-slate-500 md:text-base">
                        Flujo de caja completo: Ingresos, Gastos y Ajustes
                    </p>
                </div>
                <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:items-center">
                    <MonthPicker
                        currentMonth={selectedMonth}
                        currentYear={selectedYear}
                        onMonthChange={setSelectedMonth}
                        onYearChange={setSelectedYear}
                    />
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-3 md:grid-cols-4 md:gap-4">
                <Card className="border-slate-100 shadow-sm bg-white">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600">Flujo de Caja Neto</CardTitle>
                        <DollarSign className="h-4 w-4 text-slate-400" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${netCashFlow >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>
                            ${netCashFlow.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            Ingresos - Gastos
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-slate-100 shadow-sm bg-white">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600">Total Ingresos</CardTitle>
                        <ArrowDownLeft className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-600">
                            ${totalRevenue.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            {filteredTransactions.filter(t => t.type === 'payment').length} pagos recibidos
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-slate-100 shadow-sm bg-white">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600">Total Gastos (Pagados)</CardTitle>
                        <ArrowUpRight className="h-4 w-4 text-rose-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-rose-600">
                            ${totalExpenses.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            {filteredTransactions.filter(t => t.type === 'expense_payment').length} pagos de gastos realizados
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-slate-100 shadow-sm bg-white">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600">Cuentas por Pagar</CardTitle>
                        <FileText className="h-4 w-4 text-slate-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-700">
                            ${totalRegisteredExpenses.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            Total de gastos registrados en el mes
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Transactions Table */}
            <Card className="border-slate-100 shadow-sm bg-white">
                <CardHeader className="border-b border-slate-100 pb-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <CardTitle className="text-lg font-semibold text-slate-800">Movimientos</CardTitle>
                        <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:items-center">
                            <div className="relative w-full sm:max-w-sm">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                <Input
                                    type="search"
                                    placeholder="Buscar..."
                                    className="pl-8 border-slate-200 focus:border-slate-400"
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setPage(1);
                                    }}
                                />
                            </div>
                            <Button variant="outline" size="sm" className="w-full border-slate-200 text-slate-600 hover:bg-slate-50 sm:w-auto">
                                <Download className="h-4 w-4 mr-2" />
                                Exportar
                            </Button>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    <div className="space-y-3 p-4 md:hidden">
                        {paginatedTransactions.length > 0 ? (
                            paginatedTransactions.map((t) => {
                                const { date, amount, badge, description, category, isEditable, hasAttachments } = getTransactionView(t);
                                const isIncome = t.type === 'payment';

                                return (
                                    <div key={`${t.type}-${t.id}`} className="rounded-md border bg-white p-4 shadow-sm">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    {badge}
                                                    {category}
                                                </div>
                                                <div className="mt-2 text-sm font-medium">{description}</div>
                                            </div>
                                            <div className="shrink-0">{renderTransactionActions(t, isEditable, hasAttachments)}</div>
                                        </div>
                                        <div className="mt-4 flex items-center justify-between border-t pt-3">
                                            <span className="text-sm text-slate-500">
                                                {format(new Date(date as string), 'dd MMM yyyy', { locale: es })}
                                            </span>
                                            <span className={`text-lg font-bold ${isIncome ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {isIncome ? '+' : '-'}${Number(amount).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        {t.notes && (
                                            <p className="mt-2 line-clamp-2 text-xs text-slate-500">{t.notes}</p>
                                        )}
                                    </div>
                                );
                            })
                        ) : (
                            <div className="rounded-md border bg-white p-8 text-center text-slate-400">
                                <FileText className="mx-auto mb-2 h-8 w-8 opacity-20" />
                                <p>No se encontraron movimientos</p>
                            </div>
                        )}
                    </div>

                    <div className="hidden rounded-none border-0 md:block">
                        <Table>
                            <TableHeader className="bg-slate-50/50">
                                <TableRow className="border-slate-100">
                                    <TableHead className="text-slate-500 font-medium">Fecha</TableHead>
                                    <TableHead className="text-slate-500 font-medium">Tipo</TableHead>
                                    <TableHead className="text-slate-500 font-medium">Descripción / Referencia</TableHead>
                                    <TableHead className="text-slate-500 font-medium">Categoría / Método</TableHead>
                                    <TableHead className="text-right text-slate-500 font-medium">Monto</TableHead>
                                    <TableHead className="text-slate-500 font-medium">Notas</TableHead>
                                    <TableHead className="text-right text-slate-500 font-medium w-[80px]">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedTransactions.length > 0 ? (
                                    paginatedTransactions.map((t) => {
                                        const { date, amount, badge, description, category, isEditable, hasAttachments } = getTransactionView(t);

                                        return (
                                            <TableRow key={`${t.type}-${t.id}`} className="hover:bg-slate-50/50 border-slate-100 text-sm">
                                                <TableCell className="text-slate-500">
                                                    {format(new Date(date as string), 'dd MMM yyyy', { locale: es })}
                                                </TableCell>
                                                <TableCell>{badge}</TableCell>
                                                <TableCell className="font-medium">
                                                    {description}
                                                </TableCell>
                                                <TableCell>
                                                    {category}
                                                </TableCell>
                                                <TableCell className={`text-right font-bold ${t.type === 'payment' ? 'text-emerald-600' :
                                                    (t.type === 'expense_payment' || t.type === 'creditNote') ? 'text-rose-600' : 'text-slate-600'
                                                    }`}>
                                                    {t.type === 'payment' ? '+' : '-'}${Number(amount).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                                                </TableCell>
                                                <TableCell className="text-slate-500 max-w-xs truncate">
                                                    {t.notes || '-'}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {renderTransactionActions(t, isEditable, hasAttachments)}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-32 text-center">
                                            <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                                                <FileText className="h-8 w-8 opacity-20" />
                                                <p>No se encontraron movimientos</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-end sm:space-x-2">
                            <div className="flex-1 text-sm text-muted-foreground">
                                Página {page} de {totalPages}
                            </div>
                            <div className="grid grid-cols-2 gap-2 sm:block sm:space-x-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1 || isLoading}
                                >
                                    Anterior
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages || isLoading}
                                >
                                    Siguiente
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <EditPaymentDialog
                open={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
                payment={selectedPayment}
                onSuccess={fetchTransactions}
            />

            <EditExpensePaymentDialog
                open={isEditExpenseDialogOpen}
                onOpenChange={setIsEditExpenseDialogOpen}
                payment={selectedExpensePayment}
                onSuccess={fetchTransactions}
            />

            <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. Se eliminará el pago de ${deleteAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })} y se actualizará el saldo correspondiente.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Preview Dialog */}
            <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Comprobante de Pago</DialogTitle>
                    </DialogHeader>
                    <div className="flex items-center justify-center p-4 bg-slate-50 rounded-lg">
                        {previewUrl && (
                            <div className="relative w-full h-[60vh]">
                                <Image
                                    src={previewUrl}
                                    alt="Comprobante"
                                    fill
                                    className="object-contain"
                                    unoptimized
                                />
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
