"use client";

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Receipt, Wallet, MoreHorizontal, DollarSign, Trash2, Edit, Calendar } from 'lucide-react';
import { getExpenses, deleteExpenseAction } from '@/lib/actions/expenseActions';
import { Expense, ExpenseCategory } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreateExpenseDialog } from '@/components/expenses/create-expense-dialog';
import { PayExpenseDialog } from '@/components/expenses/pay-expense-dialog';
import { EditExpenseDialog } from '@/components/expenses/edit-expense-dialog';
import { RecurringExpensesList } from '@/components/expenses/recurring-expenses-list';
import { sendExpenseECF, checkExpenseECFStatus } from '@/lib/actions/ecfActions';
import { EcfActionButtons } from '@/components/invoices/ecf-action-buttons';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from '@/hooks/use-toast';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MonthPicker } from "@/components/ui/month-picker";

export default function ExpensesPage() {
    const currentDate = new Date();
    const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth().toString());
    const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear().toString());
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | 'Todos'>('Todos');
    const [statusFilter, setStatusFilter] = useState<string>('Todos');

    // Pagination State
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalExpensesCount, setTotalExpensesCount] = useState(0);

    // Summary calculation
    const [totals, setTotals] = useState({ total: 0, paid: 0, pending: 0 });

    // Dialog states
    const [payExpense, setPayExpense] = useState<Expense | null>(null);
    const [editExpense, setEditExpense] = useState<Expense | null>(null);
    const [deleteExpense, setDeleteExpense] = useState<Expense | null>(null);

    const { toast } = useToast();

    // Fetch expenses with all filters
    const fetchExpenses = async () => {
        setIsLoading(true);
        try {
            const offset = new Date().getTimezoneOffset();
            const result = await getExpenses(
                selectedMonth,
                selectedYear,
                offset,
                page,
                25,
                statusFilter,
                categoryFilter,
                searchTerm
            );
            setExpenses(result.expenses);
            setTotalPages(result.totalPages);
            setTotalExpensesCount(result.total);

            // Calculate current view totals
            const viewTotal = result.expenses.reduce((acc, curr) => acc + curr.amount, 0);
            const viewPaid = result.expenses.reduce((acc, curr) => acc + (curr.paidAmount || 0), 0);
            setTotals({
                total: viewTotal,
                paid: viewPaid,
                pending: viewTotal - viewPaid
            });
        } catch (error) {
            console.error("Failed to fetch expenses", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchExpenses();
        }, 300);
        return () => clearTimeout(timer);
    }, [selectedMonth, selectedYear, page, statusFilter, categoryFilter, searchTerm]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setPage(1);
    };

    const handleCategoryChange = (value: string) => {
        setCategoryFilter(value as ExpenseCategory | 'Todos');
        setPage(1);
    };

    const handleStatusChange = (value: string) => {
        setStatusFilter(value);
        setPage(1);
    };

    const handleMonthChange = (month: string) => {
        setSelectedMonth(month);
        setPage(1);
    };

    const handleYearChange = (year: string) => {
        setSelectedYear(year);
        setPage(1);
    };

    const handleDelete = async () => {
        if (!deleteExpense) return;
        const result = await deleteExpenseAction(deleteExpense.id);
        if (result.success) {
            toast({ title: "Éxito", description: "Gasto eliminado correctamente" });
            fetchExpenses();
        } else {
            toast({ title: "Error", description: result.message || "No se pudo eliminar el gasto", variant: "destructive" });
        }
        setDeleteExpense(null);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'Pagada': return <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Pagada</Badge>;
            case 'Parcial': return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">Parcial</Badge>;
            default: return <Badge variant="secondary" className="bg-orange-100 text-orange-800 hover:bg-orange-200">Pendiente</Badge>;
        }
    };

    const renderExpenseActions = (expense: Expense) => (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setEditExpense(expense)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Editar
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => setPayExpense(expense)}
                    disabled={expense.status === 'Pagada'}
                >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Registrar Pago
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    onClick={() => setDeleteExpense(expense)}
                    className="text-destructive focus:text-destructive"
                >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );

    return (
        <div className="space-y-4 md:space-y-8">
            {/* Header with Title and Add Button */}
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center md:gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Gastos</h1>
                    <p className="mt-1 text-sm text-muted-foreground md:text-base">Gestión financiera de egresos y reportes e-CF.</p>
                </div>
                <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:items-center">
                    <MonthPicker
                        currentMonth={selectedMonth}
                        currentYear={selectedYear}
                        onMonthChange={handleMonthChange}
                        onYearChange={handleYearChange}
                    />
                    <CreateExpenseDialog onSuccess={fetchExpenses} />
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <p className="text-sm font-medium">Total del Mes</p>
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${totals.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <p className="text-sm font-medium">Pagado</p>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${totals.paid.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <p className="text-sm font-medium">Pendiente</p>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${totals.pending.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content Area */}
            <Tabs defaultValue="list" className="w-full">
                <TabsList className="mb-4 grid h-auto w-full grid-cols-2 sm:inline-flex sm:w-auto">
                    <TabsTrigger value="list">Listado de Gastos</TabsTrigger>
                    <TabsTrigger value="recurring">Gastos Recurrentes</TabsTrigger>
                </TabsList>

                <TabsContent value="list" className="space-y-4">
                    {/* Filter Bar */}
                    <Card>
                        <CardHeader className="pb-4">
                            <div className="flex flex-col gap-3 md:flex-row md:justify-between md:gap-4">
                                <div className="relative w-full md:max-w-md">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Buscar descripción o proveedor..."
                                        value={searchTerm}
                                        onChange={handleSearchChange}
                                        className="pl-10"
                                    />
                                </div>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    <Select value={statusFilter} onValueChange={handleStatusChange}>
                                        <SelectTrigger className="w-full sm:w-[180px]">
                                            <SelectValue placeholder="Estado" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Todos">Todos los estados</SelectItem>
                                            <SelectItem value="Pendiente">Pendiente</SelectItem>
                                            <SelectItem value="Pagada">Pagada</SelectItem>
                                            <SelectItem value="Parcial">Parcial</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Select value={categoryFilter} onValueChange={handleCategoryChange}>
                                        <SelectTrigger className="w-full sm:w-[180px]">
                                            <SelectValue placeholder="Categoría" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Todos">Todas las categorías</SelectItem>
                                            <SelectItem value="Materia Prima">Materia Prima</SelectItem>
                                            <SelectItem value="Servicios">Servicios</SelectItem>
                                            <SelectItem value="Nómina">Nómina</SelectItem>
                                            <SelectItem value="Mantenimiento">Mantenimiento</SelectItem>
                                            <SelectItem value="Impuestos">Impuestos</SelectItem>
                                            <SelectItem value="Préstamos">Préstamos</SelectItem>
                                            <SelectItem value="Otros">Otros</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3 md:hidden">
                                {isLoading ? (
                                    <div className="rounded-md border bg-background p-8 text-center text-muted-foreground">
                                        Cargando gastos...
                                    </div>
                                ) : expenses.length > 0 ? (
                                    expenses.map((expense) => {
                                        const pendingAmount = expense.amount - (expense.paidAmount || 0);
                                        const fiscalNumber = expense.encf || expense.ncf || (expense.ncfType?.startsWith('E') ? 'POR ASIGNAR' : 'N/A');

                                        return (
                                            <div key={expense.id} className="rounded-md border bg-background p-4 shadow-sm">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <p className="truncate font-semibold">{expense.description}</p>
                                                            {getStatusBadge(expense.status)}
                                                        </div>
                                                        <p className="mt-1 text-sm text-muted-foreground">{expense.supplierName || 'Sin proveedor'}</p>
                                                    </div>
                                                    <div className="shrink-0">{renderExpenseActions(expense)}</div>
                                                </div>
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    <Badge variant="outline">{expense.category}</Badge>
                                                    {expense.invoiceNumber && <Badge variant="secondary">Factura #{expense.invoiceNumber}</Badge>}
                                                </div>
                                                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                                    <div>
                                                        <p className="text-xs font-medium uppercase text-muted-foreground">Fecha</p>
                                                        <p>{format(new Date(expense.date), 'dd MMM yyyy', { locale: es })}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-medium uppercase text-muted-foreground">E-CF / NCF</p>
                                                        <p className="font-mono text-xs">{fiscalNumber}</p>
                                                    </div>
                                                </div>
                                                {expense.ncfType?.startsWith('E') && (
                                                    <div className="mt-3">
                                                        <EcfActionButtons
                                                            invoiceId={expense.id}
                                                            ncfType={expense.ncfType}
                                                            ecfStatus={(expense as any).ecfStatus}
                                                            ecfTrackId={(expense as any).ecfTrackId}
                                                            encf={(expense as any).encf}
                                                            documentType="Expense"
                                                            onStatusChange={fetchExpenses}
                                                        />
                                                    </div>
                                                )}
                                                <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-3">
                                                    <div>
                                                        <p className="text-xs font-medium uppercase text-muted-foreground">Monto</p>
                                                        <p className="text-lg font-bold">${expense.amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xs font-medium uppercase text-muted-foreground">Pendiente</p>
                                                        <p className={`text-lg font-bold ${pendingAmount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                            ${pendingAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="rounded-md border bg-background p-8 text-center text-muted-foreground">
                                        <Receipt className="mx-auto mb-2 h-10 w-10 opacity-20" />
                                        <p>No se encontraron gastos.</p>
                                    </div>
                                )}
                            </div>

                            <div className="hidden rounded-md border overflow-hidden md:block">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Descripción</TableHead>
                                            <TableHead>e-NCF / NCF</TableHead>
                                            <TableHead>Proveedor</TableHead>
                                            <TableHead>Categoría</TableHead>
                                            <TableHead>Fecha</TableHead>
                                            <TableHead className="text-right">Monto</TableHead>
                                            <TableHead className="text-right">Pendiente</TableHead>
                                            <TableHead className="text-right">Estado</TableHead>
                                            <TableHead className="text-right">Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isLoading ? (
                                            <TableRow>
                                                <TableCell colSpan={9} className="h-24 text-center">
                                                    Cargando gastos...
                                                </TableCell>
                                            </TableRow>
                                        ) : expenses.length > 0 ? (
                                            expenses.map((expense) => {
                                                const pendingAmount = expense.amount - (expense.paidAmount || 0);
                                                return (
                                                    <TableRow key={expense.id}>
                                                        <TableCell className="font-medium">
                                                            {expense.description}
                                                            {expense.invoiceNumber && (
                                                                <div className="text-xs text-muted-foreground">#{expense.invoiceNumber}</div>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                                                                {expense.encf || expense.ncf || (expense.ncfType?.startsWith('E') ? 'POR ASIGNAR' : 'N/A')}
                                                            </div>
                                                            {expense.ncfType && (
                                                                <div className="text-xs text-muted-foreground">
                                                                    {expense.ncfType}
                                                                </div>
                                                            )}
                                                            {/* e-CF Actions similar to Invoices */}
                                                            {expense.ncfType?.startsWith('E') && (
                                                                <EcfActionButtons
                                                                    invoiceId={expense.id}
                                                                    ncfType={expense.ncfType}
                                                                    ecfStatus={(expense as any).ecfStatus}
                                                                    ecfTrackId={(expense as any).ecfTrackId}
                                                                    encf={(expense as any).encf}
                                                                    documentType="Expense"
                                                                    onStatusChange={fetchExpenses}
                                                                />
                                                            )}
                                                        </TableCell>
                                                        <TableCell>{expense.supplierName || '-'}</TableCell>
                                                        <TableCell>{expense.category}</TableCell>
                                                        <TableCell className="text-sm">
                                                            {format(new Date(expense.date), 'dd MMM yyyy', { locale: es })}
                                                        </TableCell>
                                                        <TableCell className="text-right font-bold">
                                                            ${expense.amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                                                        </TableCell>
                                                        <TableCell className={`text-right font-medium ${pendingAmount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                            ${pendingAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {getStatusBadge(expense.status)}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {renderExpenseActions(expense)}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={9} className="h-32 text-center">
                                                    <div className="flex flex-col items-center justify-center text-slate-400">
                                                        <Receipt className="h-10 w-10 mb-2 opacity-20" />
                                                        <p>No se encontraron gastos.</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination Controls */}
                            <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-end sm:space-x-2">
                                <div className="flex-1 text-sm text-muted-foreground">
                                    Página {page} de {totalPages} ({totalExpensesCount} registros)
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
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="recurring">
                    <Card>
                        <CardContent className="pt-6">
                            <RecurringExpensesList />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <PayExpenseDialog
                expense={payExpense}
                open={!!payExpense}
                onOpenChange={(open) => !open && setPayExpense(null)}
                onSuccess={fetchExpenses}
            />

            <EditExpenseDialog
                expense={editExpense}
                open={!!editExpense}
                onOpenChange={(open) => !open && setEditExpense(null)}
                onSuccess={fetchExpenses}
            />

            <AlertDialog open={!!deleteExpense} onOpenChange={(open) => !open && setDeleteExpense(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar Gasto?</AlertDialogTitle>
                        <AlertDialogDescription>
                            ¿Está seguro que desea eliminar el gasto <strong>{deleteExpense?.description}</strong>?
                            Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
