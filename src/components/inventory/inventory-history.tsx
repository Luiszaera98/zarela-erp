"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getInventoryMovements } from '@/lib/actions/inventoryActions';
import { InventoryMovement } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowDownRight, ArrowUpRight, ArrowRightLeft, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const MONTHS = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export function InventoryHistory() {
    const [month, setMonth] = useState<string>(new Date().getMonth().toString());
    const [year, setYear] = useState<string>(new Date().getFullYear().toString());
    const [movements, setMovements] = useState<InventoryMovement[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchHistory();
    }, [month, year]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const data = await getInventoryMovements(month, year);
            setMovements(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // Calculate totals
    const totalEntries = movements.filter(m => m.type === 'ENTRADA').reduce((sum, m) => sum + m.quantity, 0);
    const totalExits = movements.filter(m => m.type === 'SALIDA').reduce((sum, m) => sum + m.quantity, 0);
    const netChange = totalEntries - totalExits;

    const getIcon = (type: string) => {
        switch (type) {
            case 'ENTRADA': return <ArrowUpRight className="h-4 w-4 text-green-600" />;
            case 'SALIDA': return <ArrowDownRight className="h-4 w-4 text-red-600" />;
            default: return <ArrowRightLeft className="h-4 w-4 text-blue-600" />;
        }
    };

    const getBadgeVariant = (type: string) => {
        switch (type) {
            case 'ENTRADA': return 'default'; // dark/primary
            case 'SALIDA': return 'destructive'; // red
            default: return 'secondary';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="space-y-2 w-full sm:w-40">
                    <label className="text-sm font-medium">Mes</label>
                    <Select value={month} onValueChange={setMonth}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {MONTHS.map((m, i) => (
                                <SelectItem key={i} value={i.toString()}>{m}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2 w-full sm:w-32">
                    <label className="text-sm font-medium">Año</label>
                    <Select value={year} onValueChange={setYear}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {[0, 1, 2, 3, 4].map(i => (
                                <SelectItem key={i} value={(new Date().getFullYear() - i).toString()}>
                                    {new Date().getFullYear() - i}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Entradas</CardTitle>
                        <ArrowUpRight className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">+{totalEntries.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Unidades agregadas este mes</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Salidas</CardTitle>
                        <ArrowDownRight className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">-{totalExits.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Unidades vendidas/retiradas este mes</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Balance Neto</CardTitle>
                        <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${netChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {netChange > 0 ? '+' : ''}{netChange.toLocaleString()}
                        </div>
                        <p className="text-xs text-muted-foreground">Movimiento neto de inventario</p>
                    </CardContent>
                </Card>
            </div>

            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Producto</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Cantidad</TableHead>
                            <TableHead>Referencia</TableHead>
                            <TableHead>Notas</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                </TableCell>
                            </TableRow>
                        ) : movements.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                    No hay movimientos registrados en este período.
                                </TableCell>
                            </TableRow>
                        ) : (
                            movements.map((movement) => (
                                <TableRow key={movement.id}>
                                    <TableCell>
                                        {format(new Date(movement.date), "d 'de' MMM, yyyy", { locale: es })}
                                    </TableCell>
                                    <TableCell className="font-medium">{movement.productName}</TableCell>
                                    <TableCell>
                                        <Badge variant={getBadgeVariant(movement.type) as any} className="flex w-fit items-center gap-1">
                                            {getIcon(movement.type)}
                                            {movement.type}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className={movement.type === 'SALIDA' ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>
                                        {movement.type === 'SALIDA' ? '-' : '+'}{movement.quantity}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{movement.reference || '-'}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate" title={movement.notes}>
                                        {movement.notes || '-'}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
