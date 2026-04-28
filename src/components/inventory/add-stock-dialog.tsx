"use client";

import React, { useState, useTransition } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { addProductStock } from '@/lib/actions/inventoryActions';
import { useToast } from '@/hooks/use-toast';
import { Product } from '@/types';
import { Loader2 } from 'lucide-react';

interface AddStockDialogProps {
    product: Product | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function AddStockDialog({ product, open, onOpenChange, onSuccess }: AddStockDialogProps) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const [quantity, setQuantity] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [notes, setNotes] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!product) return;
        if (!quantity || parseFloat(quantity) <= 0) {
            toast({ title: "Error", description: "Ingrese una cantidad válida", variant: "destructive" });
            return;
        }

        startTransition(async () => {
            const result = await addProductStock(product.id, parseFloat(quantity), date, notes);

            if (result.success) {
                toast({ title: "Stock Agregado", description: `Se han agregado ${quantity} unidades a ${product.name}` });
                setQuantity('');
                setNotes('');
                onOpenChange(false);
                onSuccess();
            } else {
                toast({ title: "Error", description: result.message || "Error al agregar stock", variant: "destructive" });
            }
        });
    };

    if (!product) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Reabastecer Producto</DialogTitle>
                    <DialogDescription>
                        Agregar stock a <strong>{product.name}</strong> ({product.sku})
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label>Cantidad a Agregar *</Label>
                        <Input
                            type="number"
                            step="0.01"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            placeholder="0.00"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Fecha de Entrada *</Label>
                        <Input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Notas / Referencia</Label>
                        <Textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Ej: Compra factura #1234"
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Agregar Stock
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
