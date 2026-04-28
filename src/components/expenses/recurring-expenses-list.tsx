"use client";

import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Trash2, RefreshCw, CalendarClock } from 'lucide-react';
import { getRecurringExpenses, toggleRecurringExpense, deleteRecurringExpense } from '@/lib/actions/expenseActions';
import { RecurringExpense } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { CreateRecurringExpenseDialog } from './create-recurring-expense-dialog';
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

export function RecurringExpensesList() {
    const [expenses, setExpenses] = useState<RecurringExpense[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const { toast } = useToast();

    const fetchRecurring = async () => {
        setIsLoading(true);
        try {
            const data = await getRecurringExpenses();
            setExpenses(data);
        } catch (error) {
            console.error("Failed to fetch recurring expenses", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchRecurring();
    }, []);

    const handleToggle = async (id: string, currentStatus: boolean) => {
        const result = await toggleRecurringExpense(id, !currentStatus);
        if (result.success) {
            toast({
                title: "Estado actualizado",
                description: `La automatización ha sido ${!currentStatus ? 'activada' : 'desactivada'}.`,
            });
            fetchRecurring();
        } else {
            toast({
                title: "Error",
                description: "No se pudo cambiar el estado.",
                variant: "destructive",
            });
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        const result = await deleteRecurringExpense(deleteId);
        if (result.success) {
            toast({
                title: "Eliminado",
                description: "La configuración ha sido eliminada.",
            });
            fetchRecurring();
        } else {
            toast({
                title: "Error",
                description: "No se pudo eliminar.",
                variant: "destructive",
            });
        }
        setDeleteId(null);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <CalendarClock className="h-5 w-5" />
                        Automatizaciones Configuradas
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Estos gastos se generarán automáticamente en la fecha indicada.
                    </p>
                </div>
                <CreateRecurringExpenseDialog />
            </div>

            <Card className="border-slate-100 shadow-sm bg-white">
                <CardContent className="p-0">
                    <div className="rounded-md border border-slate-100 overflow-hidden">
                        <Table>
                            <TableHeader className="bg-slate-50/50">
                                <TableRow className="border-slate-100">
                                    <TableHead className="text-slate-500 font-medium">Descripción</TableHead>
                                    <TableHead className="text-slate-500 font-medium">Frecuencia</TableHead>
                                    <TableHead className="text-slate-500 font-medium">Monto Base</TableHead>
                                    <TableHead className="text-slate-500 font-medium">Próxima Ejecución</TableHead>
                                    <TableHead className="text-slate-500 font-medium">Última Generación</TableHead>
                                    <TableHead className="text-slate-500 font-medium">Estado</TableHead>
                                    <TableHead className="text-right text-slate-500 font-medium">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {expenses.length > 0 ? (
                                    expenses.map((expense) => (
                                        <TableRow key={expense.id} className="hover:bg-slate-50/50 border-slate-100">
                                            <TableCell className="font-medium text-slate-700">
                                                {expense.description}
                                                <div className="text-xs text-slate-500">{expense.category}</div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="border-slate-200 text-slate-600">{expense.frequency}</Badge>
                                            </TableCell>
                                            <TableCell className="text-slate-700 font-medium">${expense.amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</TableCell>
                                            <TableCell className="text-slate-600">
                                                {format(new Date(expense.nextRun), 'dd MMM yyyy', { locale: es })}
                                            </TableCell>
                                            <TableCell className="text-slate-500 text-sm">
                                                {expense.lastGenerated ? format(new Date(expense.lastGenerated), 'dd MMM yyyy', { locale: es }) : '-'}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Switch
                                                        checked={expense.active}
                                                        onCheckedChange={() => handleToggle(expense.id, expense.active)}
                                                    />
                                                    <span className="text-xs text-slate-500">{expense.active ? 'Activo' : 'Inactivo'}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    onClick={() => setDeleteId(expense.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-32 text-center text-slate-400">
                                            No hay gastos recurrentes configurados.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar Automatización?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Se dejarán de generar gastos automáticos para esta configuración. Los gastos ya generados no se verán afectados.
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
