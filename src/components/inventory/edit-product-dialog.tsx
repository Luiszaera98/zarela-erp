"use client";

import React, { useState, useEffect, useTransition } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { updateProduct } from '@/lib/actions/inventoryActions';
import { useToast } from '@/hooks/use-toast';
import { Product, ProductType } from '@/types';
import { getChorizoTypes, getUnitTypes, getProductTypes } from '@/lib/actions/settingsActions';

interface EditProductDialogProps {
    product: Product | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function EditProductDialog({ product, open, onOpenChange, onSuccess }: EditProductDialogProps) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    // Form state
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [cost, setCost] = useState('');
    const [stock, setStock] = useState('');
    const [minStock, setMinStock] = useState('');
    const [unit, setUnit] = useState('Unidad');
    const [description, setDescription] = useState('');
    const [type, setType] = useState<ProductType>('Materia Prima');
    const [chorizoTypes, setChorizoTypes] = useState<string[]>([]);
    const [unitTypes, setUnitTypes] = useState<string[]>([]);
    const [productTypes, setProductTypes] = useState<string[]>([]);

    useEffect(() => {
        if (open) {
            getUnitTypes().then(setUnitTypes);
            getProductTypes().then(setProductTypes);
        }

        if (open && product) {
            setName(product.name);
            setPrice(product.price.toString());
            setCost(product.cost.toString());
            setStock(product.stock.toString());
            setMinStock(product.minStock.toString());
            setUnit(product.unit);
            setDescription(product.description || '');
            setType(product.type);

            if (product.type === 'Chorizo') {
                getChorizoTypes().then(setChorizoTypes);
            }
        }
    }, [open, product]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!product) return;
        if (!name || !stock || !unit) {
            toast({
                title: "Error de validación",
                description: "Por favor complete todos los campos requeridos.",
                variant: "destructive",
            });
            return;
        }

        startTransition(async () => {
            const result = await updateProduct(product.id, {
                name,
                price: parseFloat(price) || 0,
                cost: parseFloat(cost) || 0,
                stock: parseFloat(stock), // Changed to parseFloat to allow decimals
                minStock: minStock ? parseFloat(minStock) : 0, // Changed to parseFloat
                unit,
                description,
            });

            if (result.success) {
                toast({
                    title: "Producto actualizado",
                    description: `El producto ${name} ha sido actualizado exitosamente.`,
                });
                onOpenChange(false);
                onSuccess();
            } else {
                toast({
                    title: "Error",
                    description: result.message || "No se pudo actualizar el producto.",
                    variant: "destructive",
                });
            }
        });
    };

    if (!product) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Editar Producto</DialogTitle>
                    <DialogDescription>
                        Modifique los detalles del producto {product.sku}.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6 py-4">

                    {/* Basic Info Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="name">Nombre del Producto *</Label>
                            {type === 'Chorizo' ? (
                                <Select value={name} onValueChange={setName}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccione un producto" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {chorizoTypes.map((chorizo) => (
                                            <SelectItem key={chorizo} value={chorizo}>{chorizo}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Input
                                    id="name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    className="font-medium"
                                />
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="type">Categoría</Label>
                            <Select value={type} onValueChange={(val) => setType(val as ProductType)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {productTypes.map((pt) => (
                                        <SelectItem key={pt} value={pt}>{pt}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="unit">Tipo de Medida *</Label>
                            <Select value={unit} onValueChange={setUnit}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccione unidad" />
                                </SelectTrigger>
                                <SelectContent>
                                    {unitTypes.map((u) => (
                                        <SelectItem key={u} value={u}>{u}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Descripción <span className="text-muted-foreground font-normal">(Opcional)</span></Label>
                        <Input
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Descripción detallada para la factura"
                        />
                    </div>

                    <div className="border-t border-slate-100 my-4"></div>

                    {/* Stock & Pricing Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="stock">Stock Actual *</Label>
                            <Input
                                id="stock"
                                type="number"
                                step="0.01" // Allow decimals
                                value={stock}
                                onChange={(e) => setStock(e.target.value)}
                                required
                                className="font-mono"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="minStock">Stock Mínimo</Label>
                            <Input
                                id="minStock"
                                type="number"
                                step="0.01" // Allow decimals
                                value={minStock}
                                onChange={(e) => setMinStock(e.target.value)}
                                placeholder="0.00"
                                className="font-mono"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="price">Precio de Venta</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                <Input
                                    id="price"
                                    type="number"
                                    step="0.01"
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                    className="pl-7 font-mono"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="cost">Costo Unitario</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                <Input
                                    id="cost"
                                    type="number"
                                    step="0.01"
                                    value={cost}
                                    onChange={(e) => setCost(e.target.value)}
                                    className="pl-7 font-mono"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending ? "Guardando..." : "Guardar Cambios"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
