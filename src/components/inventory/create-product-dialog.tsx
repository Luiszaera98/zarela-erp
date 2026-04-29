"use client";

import React, { useState, useTransition } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle } from 'lucide-react';
import { createProduct } from '@/lib/actions/inventoryActions';
import { addProductNameToCategory, getUnitTypes, getProductTypes, getProductTypeCatalog } from '@/lib/actions/settingsActions';
import { useToast } from '@/hooks/use-toast';
import { ProductType, ProductTypeCatalog } from '@/types';

interface CreateProductDialogProps {
    onProductCreated?: () => void;
}

export function CreateProductDialog({ onProductCreated }: CreateProductDialogProps) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const normalizeName = (value: string) => value.trim().replace(/\s+/g, ' ').toUpperCase();

    // Form state
    const [type, setType] = useState<ProductType>('Chorizo');
    const [name, setName] = useState('');
    const [customName, setCustomName] = useState(''); // For Materia Prima
    const [manualNameMode, setManualNameMode] = useState(false);
    const [price, setPrice] = useState('');
    const [cost, setCost] = useState('');
    const [stock, setStock] = useState('');
    const [minStock, setMinStock] = useState('');
    const [unit, setUnit] = useState('Unidad');
    const [description, setDescription] = useState('');

    // Dynamic Data
    const [unitTypes, setUnitTypes] = useState<string[]>([]);
    const [productTypes, setProductTypes] = useState<string[]>([]);
    const [productTypeCatalog, setProductTypeCatalog] = useState<ProductTypeCatalog>({});

    // Fetch types when dialog opens
    React.useEffect(() => {
        if (open) {
            getUnitTypes().then(setUnitTypes);
            getProductTypes().then(setProductTypes);
            getProductTypeCatalog().then(setProductTypeCatalog);
        }
    }, [open]);

    const resetForm = () => {
        setType('Chorizo');
        setName('');
        setCustomName('');
        setManualNameMode(false);
        setPrice('');
        setCost('');
        setStock('');
        setMinStock('');
        setUnit('Unidad');
        setDescription('');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const categoryProductTypes = productTypeCatalog[type] || [];
        const finalName = normalizeName(!manualNameMode && categoryProductTypes.length > 0 ? name : customName);

        if (!finalName || !stock || !unit) {
            toast({
                title: "Error de validación",
                description: "Por favor complete todos los campos requeridos.",
                variant: "destructive",
            });
            return;
        }

        // Validation based on type
        if (type === 'Chorizo' && !price) {
            toast({ title: "Error", description: "El precio de venta es requerido para Chorizos.", variant: "destructive" });
            return;
        }
        if (type !== 'Chorizo' && !cost) {
            // Generic validation for cost on non-Chorizo items
            // But wait, the previous code had specific checks.
            // Let's perform a generic check if we want, or keep it strict.
            // User wants flexibility. Let's require cost for anything that is NOT a Chorizo (finished product often has cost = 0 if calculated from recipe, but here we input it manual).
            // Actually, let's stick to the previous logic but slightly more generic.
            if (!cost) {
                toast({ title: "Error", description: "El costo es requerido.", variant: "destructive" });
                return;
            }
        }

        startTransition(async () => {
            if (manualNameMode && finalName) {
                await addProductNameToCategory(type, finalName);
            }

            const result = await createProduct({
                name: finalName,
                type,
                price: parseFloat(price) || 0,
                cost: parseFloat(cost) || 0,
                stock: parseFloat(stock),
                minStock: minStock ? parseFloat(minStock) : 0,
                unit,
                description,
            });

            if (result.success) {
                toast({
                    title: "Producto creado",
                    description: `El producto ${finalName} ha sido creado exitosamente.`,
                });
                setOpen(false);
                resetForm();
                if (onProductCreated) {
                    onProductCreated();
                }
            } else {
                toast({
                    title: "Error",
                    description: result.message || "No se pudo crear el producto.",
                    variant: "destructive",
                });
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                    <PlusCircle className="mr-2 h-5 w-5" /> Nuevo Producto
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Crear Nuevo Producto</DialogTitle>
                    <DialogDescription>
                        Añada un nuevo ítem al inventario. El código SKU se generará automáticamente.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">

                    <div className="space-y-2">
                        <Label htmlFor="type">Categoría *</Label>
                        <Select value={type} onValueChange={(val) => {
                            setType(val as ProductType);
                            setName(''); // Reset name selection
                            setCustomName('');
                            setManualNameMode((productTypeCatalog[val] || []).length === 0);
                        }}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccione tipo" />
                            </SelectTrigger>
                            <SelectContent>
                                {productTypes.map((pt) => (
                                    <SelectItem key={pt} value={pt}>{pt}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <Label htmlFor="name">Tipo de producto *</Label>
                        {(productTypeCatalog[type] || []).length > 0 && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setManualNameMode(prev => !prev);
                                        setName('');
                                        setCustomName('');
                                    }}
                                    className="h-7 px-2 text-xs"
                                >
                                    {manualNameMode ? 'Usar lista' : 'Digitar manual'}
                                </Button>
                            )}
                        </div>
                        {(productTypeCatalog[type] || []).length > 0 && !manualNameMode ? (
                            <Select value={name} onValueChange={setName}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccione el tipo de producto" />
                                </SelectTrigger>
                                <SelectContent>
                                    {(productTypeCatalog[type] || []).map((productType) => (
                                        <SelectItem key={productType} value={productType}>{productType}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <Input
                                id="customName"
                                value={customName}
                                onChange={(e) => setCustomName(e.target.value)}
                                placeholder={`Digite el tipo de producto para ${type}`}
                                required
                            />
                        )}
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

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="stock">Stock Inicial *</Label>
                            <Input
                                id="stock"
                                type="number"
                                step="0.01" // Allow decimals
                                value={stock}
                                onChange={(e) => setStock(e.target.value)}
                                placeholder="0.00"
                                required
                            />
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

                    <div className="grid gap-4 sm:grid-cols-2">
                        {type === 'Chorizo' ? (
                            <div className="space-y-2">
                                <Label htmlFor="price">Precio de Venta *</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                    <Input
                                        id="price"
                                        type="number"
                                        step="0.01"
                                        value={price}
                                        onChange={(e) => setPrice(e.target.value)}
                                        className="pl-7"
                                        placeholder="0.00"
                                        required
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Label htmlFor="cost">Costo Unitario *</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                    <Input
                                        id="cost"
                                        type="number"
                                        step="0.01"
                                        value={cost}
                                        onChange={(e) => setCost(e.target.value)}
                                        className="pl-7"
                                        placeholder="0.00"
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="minStock">Stock Mínimo <span className="text-muted-foreground font-normal">(Opcional)</span></Label>
                            <Input
                                id="minStock"
                                type="number"
                                step="0.01" // Allow decimals
                                value={minStock}
                                onChange={(e) => setMinStock(e.target.value)}
                                placeholder="0.00"
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending} className="w-full sm:w-auto">
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
                            {isPending ? "Guardando..." : "Guardar Producto"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
