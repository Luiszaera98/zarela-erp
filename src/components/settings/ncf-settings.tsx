"use client";

import React, { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Save, RefreshCw } from 'lucide-react';
import { updateNCFSequence } from '@/lib/actions/settingsActions';
import { useToast } from '@/hooks/use-toast';
import { NCF_TYPES } from '@/types';
import { Badge } from '@/components/ui/badge';

interface NCFSettingsProps {
    initialSequences: { type: string; currentValue: number }[];
}

/**
 * Genera la vista previa del próximo NCF con el formato correcto DGII:
 * - B series (tradicional): 3 chars tipo + 8 dígitos secuencia = 11 chars total
 * - E series (electrónico): 3 chars tipo + 10 dígitos secuencia = 13 chars total
 */
function formatNextNCF(type: string, currentValue: number): string {
    const nextValue = currentValue + 1;
    if (type.startsWith('E')) {
        // e-NCF: E31 + 10 dígitos = 13 caracteres total
        return `${type}${String(nextValue).padStart(10, '0')}`;
    }
    // NCF tradicional: B01 + 8 dígitos = 11 caracteres total
    return `${type}${String(nextValue).padStart(8, '0')}`;
}

export function NCFSettings({ initialSequences }: NCFSettingsProps) {
    const [sequences, setSequences] = useState(initialSequences);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const [editingValues, setEditingValues] = useState<Record<string, number>>({});

    const handleValueChange = (type: string, value: string) => {
        const numValue = parseInt(value);
        if (!isNaN(numValue)) {
            setEditingValues(prev => ({ ...prev, [type]: numValue }));
        }
    };

    const handleSave = (type: string) => {
        const newValue = editingValues[type];
        if (newValue === undefined) return;

        startTransition(async () => {
            const result = await updateNCFSequence(type, newValue);
            if (result.success) {
                setSequences(prev => prev.map(s => s.type === type ? { ...s, currentValue: newValue } : s));
                setEditingValues(prev => {
                    const next = { ...prev };
                    delete next[type];
                    return next;
                });
                toast({ title: "Secuencia actualizada", description: `La secuencia para ${type} se actualizó a ${newValue}.` });
            } else {
                toast({ title: "Error", description: result.message, variant: "destructive" });
            }
        });
    };

    const handleSync = () => {
        startTransition(async () => {
            const { syncNCFSequences } = await import('@/lib/actions/settingsActions');
            const result = await syncNCFSequences();
            if (result.success) {
                toast({ title: "Sincronización Completada", description: result.message });
                window.location.reload();
            } else {
                toast({ title: "Error", description: result.message, variant: "destructive" });
            }
        });
    };

    // Separar en tradicionales y electrónicos
    const traditional = sequences.filter(s => s.type.startsWith('B'));
    const electronic = sequences.filter(s => s.type.startsWith('E'));

    const renderSequenceRow = (seq: { type: string; currentValue: number }) => {
        const currentVal = editingValues[seq.type] !== undefined ? editingValues[seq.type] : seq.currentValue;
        const isElectronic = seq.type.startsWith('E');
        const preview = formatNextNCF(seq.type, currentVal);

        return (
            <TableRow key={seq.type}>
                <TableCell className="font-medium">
                    <Badge
                        variant="outline"
                        className={isElectronic
                            ? "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800"
                            : "bg-gray-50 text-gray-700 border-gray-300 dark:bg-gray-900 dark:text-gray-400 dark:border-gray-700"
                        }
                    >
                        {seq.type}
                    </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                    {NCF_TYPES[seq.type as keyof typeof NCF_TYPES] || 'Desconocido'}
                </TableCell>
                <TableCell>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                        {preview}
                    </code>
                    <span className="text-xs text-muted-foreground ml-1">
                        ({preview.length} chars)
                    </span>
                </TableCell>
                <TableCell className="text-right">
                    <Input
                        type="number"
                        className="w-32 ml-auto text-right"
                        value={currentVal}
                        onChange={(e) => handleValueChange(seq.type, e.target.value)}
                    />
                </TableCell>
                <TableCell className="text-right">
                    <Button
                        size="sm"
                        onClick={() => handleSave(seq.type)}
                        disabled={isPending || editingValues[seq.type] === undefined || editingValues[seq.type] === seq.currentValue}
                    >
                        <Save className="h-4 w-4 mr-2" /> Guardar
                    </Button>
                </TableCell>
            </TableRow>
        );
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Secuencias NCF</CardTitle>
                    <CardDescription>
                        Ajuste el valor actual de las secuencias de Comprobantes Fiscales.
                        El sistema usará el siguiente número (Valor Actual + 1) para la próxima factura.
                    </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={handleSync} disabled={isPending}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${isPending ? 'animate-spin' : ''}`} />
                    Sincronizar Secuencias
                </Button>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Tradicionales */}
                {traditional.length > 0 && (
                    <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                            NCF Tradicionales (Serie B — 11 caracteres)
                        </h4>
                        <div className="border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Tipo</TableHead>
                                        <TableHead>Descripción</TableHead>
                                        <TableHead>Próximo NCF</TableHead>
                                        <TableHead className="text-right">Último Valor Usado</TableHead>
                                        <TableHead className="w-[150px] text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {traditional.map(renderSequenceRow)}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}

                {/* Electrónicos */}
                {electronic.length > 0 && (
                    <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                            e-NCF Electrónicos (Serie E — 13 caracteres)
                        </h4>
                        <div className="border rounded-md border-blue-200 dark:border-blue-900">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Tipo</TableHead>
                                        <TableHead>Descripción</TableHead>
                                        <TableHead>Próximo e-NCF</TableHead>
                                        <TableHead className="text-right">Último Valor Usado</TableHead>
                                        <TableHead className="w-[150px] text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {electronic.map(renderSequenceRow)}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
