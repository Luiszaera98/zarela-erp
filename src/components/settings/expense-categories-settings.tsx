"use client";

import React, { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Plus } from 'lucide-react';
import { addExpenseCategory, removeExpenseCategory } from '@/lib/actions/settingsActions';
import { useToast } from '@/hooks/use-toast';

interface ExpenseCategoriesSettingsProps {
    initialCategories: string[];
}

export function ExpenseCategoriesSettings({ initialCategories }: ExpenseCategoriesSettingsProps) {
    const [categories, setCategories] = useState<string[]>(initialCategories);
    const [newCategory, setNewCategory] = useState('');
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const handleAdd = () => {
        if (!newCategory.trim()) return;

        startTransition(async () => {
            const result = await addExpenseCategory(newCategory);
            if (result.success) {
                setCategories([...categories, newCategory]);
                setNewCategory('');
                toast({ title: "Categoría agregada", description: `Se agregó "${newCategory}" a la lista.` });
            } else {
                toast({ title: "Error", description: result.message, variant: "destructive" });
            }
        });
    };

    const handleRemove = (category: string) => {
        startTransition(async () => {
            const result = await removeExpenseCategory(category);
            if (result.success) {
                setCategories(categories.filter(c => c !== category));
                toast({ title: "Categoría eliminada", description: `Se eliminó "${category}" de la lista.` });
            } else {
                toast({ title: "Error", description: result.message, variant: "destructive" });
            }
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Categorías de Gastos</CardTitle>
                <CardDescription>Gestione las categorías para clasificar sus gastos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-2">
                    <Input
                        placeholder="Nueva categoría de gasto..."
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    />
                    <Button onClick={handleAdd} disabled={isPending || !newCategory.trim()}>
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
                            {categories.map((category) => (
                                <TableRow key={category}>
                                    <TableCell>{category}</TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleRemove(category)}
                                            disabled={isPending}
                                            className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {categories.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={2} className="text-center text-muted-foreground h-24">
                                        No hay categorías definidas.
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
