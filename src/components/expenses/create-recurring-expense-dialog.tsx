"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { createRecurringExpense } from "@/lib/actions/expenseActions";
import { ExpenseCategory } from "@/types";
import { PlusCircle, Loader2 } from "lucide-react";

export function CreateRecurringExpenseDialog() {
    const [open, setOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        description: "",
        amount: "",
        category: "Otros" as ExpenseCategory,
        supplier: "",
        frequency: "Mensual" as "Semanal" | "Quincenal" | "Mensual" | "Anual",
        dayOfMonth: "",
        nextRun: new Date().toISOString().split('T')[0],
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name: string, value: string) => {
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const result = await createRecurringExpense({
                description: formData.description,
                amount: parseFloat(formData.amount),
                category: formData.category,
                supplier: formData.supplier,
                frequency: formData.frequency,
                dayOfMonth: formData.dayOfMonth ? parseInt(formData.dayOfMonth) : undefined,
                nextRun: formData.nextRun,
                active: true
            });

            if (result.success) {
                toast({
                    title: "Automatización creada",
                    description: "El gasto recurrente se ha configurado correctamente.",
                });
                setOpen(false);
                setFormData({
                    description: "",
                    amount: "",
                    category: "Otros",
                    supplier: "",
                    frequency: "Mensual",
                    dayOfMonth: "",
                    nextRun: new Date().toISOString().split('T')[0],
                });
            } else {
                toast({
                    title: "Error",
                    description: result.message || "No se pudo crear la automatización.",
                    variant: "destructive",
                });
            }
        } catch (error) {
            console.error(error);
            toast({
                title: "Error",
                description: "Ocurrió un error inesperado.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                    <PlusCircle className="mr-2 h-5 w-5" /> Nueva Automatización
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Configurar Gasto Recurrente</DialogTitle>
                    <DialogDescription>
                        El sistema generará automáticamente este gasto según la frecuencia elegida.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 col-span-2">
                            <Label htmlFor="description">Descripción</Label>
                            <Input
                                id="description"
                                name="description"
                                placeholder="Ej: Alquiler Local, Nómina Base..."
                                value={formData.description}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="amount">Monto Base</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                <Input
                                    id="amount"
                                    name="amount"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="pl-7"
                                    placeholder="0.00"
                                    value={formData.amount}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="category">Categoría</Label>
                            <Select
                                value={formData.category}
                                onValueChange={(val) => handleSelectChange("category", val)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccione..." />
                                </SelectTrigger>
                                <SelectContent>
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
                        <div className="space-y-2">
                            <Label htmlFor="frequency">Frecuencia</Label>
                            <Select
                                value={formData.frequency}
                                onValueChange={(val) => handleSelectChange("frequency", val)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccione..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Semanal">Semanal</SelectItem>
                                    <SelectItem value="Quincenal">Quincenal</SelectItem>
                                    <SelectItem value="Mensual">Mensual</SelectItem>
                                    <SelectItem value="Anual">Anual</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="nextRun">Próxima Ejecución</Label>
                            <Input
                                id="nextRun"
                                name="nextRun"
                                type="date"
                                value={formData.nextRun}
                                onChange={handleChange}
                                required
                            />
                            <p className="text-[10px] text-muted-foreground">Fecha del primer gasto a generar.</p>
                        </div>
                        {formData.frequency === 'Mensual' && (
                            <div className="space-y-2">
                                <Label htmlFor="dayOfMonth">Día del Mes (Opcional)</Label>
                                <Input
                                    id="dayOfMonth"
                                    name="dayOfMonth"
                                    type="number"
                                    min="1"
                                    max="31"
                                    placeholder="Ej: 5"
                                    value={formData.dayOfMonth}
                                    onChange={handleChange}
                                />
                            </div>
                        )}
                        <div className="space-y-2 col-span-2">
                            <Label htmlFor="supplier">Proveedor (Opcional)</Label>
                            <Input
                                id="supplier"
                                name="supplier"
                                placeholder="Nombre del proveedor"
                                value={formData.supplier}
                                onChange={handleChange}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Crear Automatización
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
