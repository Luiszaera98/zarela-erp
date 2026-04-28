"use client";

import React, { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Plus } from 'lucide-react';
import { addProductNameToCategory, addProductType, removeProductNameFromCategory, removeProductType } from '@/lib/actions/settingsActions';
import { useToast } from '@/hooks/use-toast';
import { ProductTypeCatalog } from '@/types';

interface ProductTypesSettingsProps {
    initialTypes: string[];
    initialCatalog: ProductTypeCatalog;
}

export function ProductTypesSettings({ initialTypes, initialCatalog }: ProductTypesSettingsProps) {
    const [types, setTypes] = useState<string[]>(initialTypes);
    const [catalog, setCatalog] = useState<ProductTypeCatalog>(initialCatalog);
    const [newType, setNewType] = useState('');
    const [newProductNames, setNewProductNames] = useState<Record<string, string>>({});
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const normalizeName = (value: string) => value.trim().replace(/\s+/g, ' ').toUpperCase();

    const handleAdd = () => {
        const normalizedType = normalizeName(newType);
        if (!normalizedType) return;

        startTransition(async () => {
            const result = await addProductType(normalizedType);
            if (result.success) {
                setTypes([...types, normalizedType]);
                setCatalog(prev => ({ ...prev, [normalizedType]: [] }));
                setNewType('');
                toast({ title: "Tipo agregado", description: `Se agregó "${normalizedType}" a la lista.` });
            } else {
                toast({ title: "Error", description: result.message, variant: "destructive" });
            }
        });
    };

    const handleRemove = (type: string) => {
        startTransition(async () => {
            const result = await removeProductType(type);
            if (result.success) {
                setTypes(types.filter(t => t !== type));
                setCatalog(prev => {
                    const next = { ...prev };
                    delete next[type];
                    return next;
                });
                toast({ title: "Tipo eliminado", description: `Se eliminó "${type}" de la lista.` });
            } else {
                toast({ title: "Error", description: result.message, variant: "destructive" });
            }
        });
    };

    const handleAddProductName = (category: string) => {
        const productName = normalizeName(newProductNames[category] || '');
        if (!productName) return;

        startTransition(async () => {
            const result = await addProductNameToCategory(category, productName);
            if (result.success) {
                setCatalog(prev => ({
                    ...prev,
                    [category]: Array.from(new Set([...(prev[category] || []), productName])),
                }));
                setNewProductNames(prev => ({ ...prev, [category]: '' }));
                toast({ title: "Producto asociado", description: `${productName} fue agregado a ${category}.` });
            } else {
                toast({ title: "Error", description: result.message, variant: "destructive" });
            }
        });
    };

    const handleRemoveProductName = (category: string, productName: string) => {
        startTransition(async () => {
            const result = await removeProductNameFromCategory(category, productName);
            if (result.success) {
                setCatalog(prev => ({
                    ...prev,
                    [category]: (prev[category] || []).filter(item => item !== productName),
                }));
                toast({ title: "Producto removido", description: `${productName} fue removido de ${category}.` });
            } else {
                toast({ title: "Error", description: result.message, variant: "destructive" });
            }
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Tipos (Categorías) de Inventario</CardTitle>
                <CardDescription>Defina las categorías generales de sus productos (ej. Chorizo, Materia Prima, Equipos).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-2">
                    <Input
                        placeholder="Nueva categoría..."
                        value={newType}
                        onChange={(e) => setNewType(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    />
                    <Button onClick={handleAdd} disabled={isPending || !newType.trim()}>
                        <Plus className="h-4 w-4 mr-2" /> Agregar
                    </Button>
                </div>

                <div className="space-y-4">
                    {types.map((type) => (
                        <div key={type} className="rounded-md border">
                            <div className="flex items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
                                <div>
                                    <div className="font-medium">{type}</div>
                                    <div className="text-xs text-muted-foreground">{(catalog[type] || []).length} tipos de producto asociados</div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemove(type)}
                                    disabled={isPending}
                                    className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="p-4 space-y-3">
                                <div className="flex gap-2">
                                    <Input
                                        placeholder={`Nuevo tipo para ${type}...`}
                                        value={newProductNames[type] || ''}
                                        onChange={(e) => setNewProductNames(prev => ({ ...prev, [type]: e.target.value }))}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddProductName(type)}
                                    />
                                    <Button onClick={() => handleAddProductName(type)} disabled={isPending || !newProductNames[type]?.trim()}>
                                        <Plus className="h-4 w-4 mr-2" /> Asociar
                                    </Button>
                                </div>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Tipo de producto</TableHead>
                                            <TableHead className="w-[100px] text-right">Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {(catalog[type] || []).map((productName) => (
                                            <TableRow key={productName}>
                                                <TableCell>{productName}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleRemoveProductName(type, productName)}
                                                        disabled={isPending}
                                                        className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {(catalog[type] || []).length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={2} className="h-16 text-center text-muted-foreground">
                                                    No hay tipos de producto asociados.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    ))}
                    {types.length === 0 && (
                        <div className="rounded-md border p-8 text-center text-muted-foreground">
                            No hay categorías definidas.
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
