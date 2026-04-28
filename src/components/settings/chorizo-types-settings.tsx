"use client";

import React, { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Plus } from 'lucide-react';
import { addChorizoType, removeChorizoType } from '@/lib/actions/settingsActions';
import { useToast } from '@/hooks/use-toast';

interface ChorizoTypesSettingsProps {
    initialTypes: string[];
}

export function ChorizoTypesSettings({ initialTypes }: ChorizoTypesSettingsProps) {
    const [types, setTypes] = useState<string[]>(initialTypes);
    const [newType, setNewType] = useState('');
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const handleAdd = () => {
        if (!newType.trim()) return;

        startTransition(async () => {
            const result = await addChorizoType(newType);
            if (result.success) {
                setTypes([...types, newType]);
                setNewType('');
                toast({ title: "Tipo agregado", description: `Se agregó "${newType}" a la lista.` });
            } else {
                toast({ title: "Error", description: result.message, variant: "destructive" });
            }
        });
    };

    const handleRemove = (type: string) => {
        startTransition(async () => {
            const result = await removeChorizoType(type);
            if (result.success) {
                setTypes(types.filter(t => t !== type));
                toast({ title: "Tipo eliminado", description: `Se eliminó "${type}" de la lista.` });
            } else {
                toast({ title: "Error", description: result.message, variant: "destructive" });
            }
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Tipos de Producto</CardTitle>
                <CardDescription>Gestione la lista de nombres de productos disponibles.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-2">
                    <Input
                        placeholder="Nuevo tipo de producto..."
                        value={newType}
                        onChange={(e) => setNewType(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    />
                    <Button onClick={handleAdd} disabled={isPending || !newType.trim()}>
                        <Plus className="h-4 w-4 mr-2" /> Agregar
                    </Button>
                </div>

                <div className="border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nombre</TableHead>
                                <TableHead className="w-[100px] text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {types.map((type) => (
                                <TableRow key={type}>
                                    <TableCell>{type}</TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleRemove(type)}
                                            disabled={isPending}
                                            className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {types.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={2} className="text-center text-muted-foreground h-24">
                                        No hay tipos definidos.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
