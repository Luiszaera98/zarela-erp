"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
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
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/hooks/use-toast";
import { updateExpense } from "@/lib/actions/expenseActions";
import { getContacts } from "@/lib/actions/clientActions";
import { uploadFile } from "@/lib/actions/uploadActions";
import { getExpenseCategories } from "@/lib/actions/settingsActions";
import { ExpenseCategory, Expense } from "@/types";
import { Loader2, Upload, X, FileText, Receipt, Edit } from "lucide-react";
import Image from "next/image";

interface EditExpenseDialogProps {
    expense: Expense | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export function EditExpenseDialog({ expense, open, onOpenChange, onSuccess }: EditExpenseDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    // Contacts for supplier selection
    const [contacts, setContacts] = useState<{ id: string; name: string; type: string; rncCedula?: string }[]>([]);
    const [categories, setCategories] = useState<string[]>([]);

    const [attachment, setAttachment] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const [formData, setFormData] = useState({
        description: "",
        amount: "",
        category: "Otros" as ExpenseCategory,
        date: "",
        supplierName: "",
        supplierRnc: "",
        invoiceNumber: "",
        status: "Pendiente" as "Pagada" | "Pendiente" | "Parcial",
        paymentMethod: "Efectivo",
        notes: "",
        ncfType: "Ninguno",
        ncf: ""
    });

    useEffect(() => {
        if (open) {
            loadContacts();
            getExpenseCategories().then(setCategories);
        }
    }, [open]);

    const loadContacts = async () => {
        try {
            const data = await getContacts();
            setContacts(data);
        } catch (error) {
            console.error("Failed to load contacts", error);
        }
    };

    useEffect(() => {
        if (expense) {
            // Extract date part YYYY-MM-DD
            let dateStr = "";
            if (expense.date) {
                const d = new Date(expense.date);
                if (!isNaN(d.getTime())) {
                    dateStr = d.toISOString().split('T')[0];
                }
            }

            setFormData({
                description: expense.description || "",
                amount: expense.amount.toString(),
                category: expense.category,
                date: dateStr,
                supplierName: expense.supplierName || "",
                supplierRnc: expense.supplierRnc || "",
                invoiceNumber: expense.invoiceNumber || "",
                status: expense.status || "Pendiente",
                paymentMethod: expense.paymentMethod || "Efectivo",
                notes: expense.notes || "",
                ncfType: expense.ncfType || "Ninguno",
                ncf: expense.ncf || expense.invoiceNumber || ""
            });

            // Set existing attachment if any
            if (expense.attachments && expense.attachments.length > 0) {
                setAttachment(expense.attachments[0]);
            } else {
                setAttachment(null);
            }
        }
    }, [expense]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name: string, value: string) => {
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleContactSelect = (value: string) => {
        const contact = contacts.find((c) => c.id === value);
        if (!contact) return;
        setFormData(prev => ({
            ...prev,
            supplierName: contact.name,
            supplierRnc: contact.rncCedula || prev.supplierRnc,
        }));
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const data = new FormData();
        data.append('file', file);

        try {
            const result = await uploadFile(data);
            if (result.success && result.url) {
                setAttachment(result.url);
                toast({ title: "Archivo adjuntado correctamente" });
            } else {
                toast({ title: "Error al subir archivo", variant: "destructive" });
            }
        } catch (error) {
            console.error(error);
            toast({ title: "Error inesperado al subir", variant: "destructive" });
        } finally {
            setIsUploading(false);
        }
    };

    const handleRemoveAttachment = () => {
        setAttachment(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!expense) return;

        setIsLoading(true);

        try {
            if (formData.ncfType === 'E41' && !formData.supplierRnc.trim()) {
                toast({
                    title: "Falta RNC/Cédula del proveedor",
                    description: "Para enviar un E41 debes registrar el RNC o la cédula del proveedor/beneficiario.",
                    variant: "destructive",
                });
                return;
            }

            const result = await updateExpense(expense.id, {
                description: formData.description,
                amount: parseFloat(formData.amount),
                category: formData.category,
                date: formData.date,
                supplierName: formData.supplierName,
                supplierRnc: formData.supplierRnc || undefined,
                invoiceNumber: formData.ncf || formData.invoiceNumber || undefined,
                status: formData.status as any,
                paymentMethod: formData.paymentMethod,
                notes: formData.notes,
                attachments: attachment ? [attachment] : [],
                ncfType: formData.ncfType !== 'Ninguno' ? formData.ncfType : undefined,
                ncf: formData.ncf || undefined,
            });

            if (result.success) {
                toast({
                    title: "Gasto actualizado",
                    description: "Los cambios se han guardado correctamente.",
                });
                onOpenChange(false);
                if (onSuccess) onSuccess();
            } else {
                toast({
                    title: "Error",
                    description: result.message || "No se pudo actualizar el gasto.",
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

    const isElectronicExpense = ['E41', 'E43', 'E47'].includes(formData.ncfType);
    const providerContacts = contacts.filter(contact => contact.type === 'Proveedor');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Editar Gasto</DialogTitle>
                    <DialogDescription>
                        Modifique los detalles del egreso. Presione guardar cambios al finalizar.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 col-span-2">
                            <Label htmlFor="description">Descripción / Concepto</Label>
                            <Input
                                id="description"
                                name="description"
                                placeholder="Ej: Pago de Alquiler, Insumos..."
                                value={formData.description}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="amount">Monto RD$</Label>
                            <Input
                                id="amount"
                                name="amount"
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={formData.amount}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="date">Fecha</Label>
                            <DatePicker
                                id="date"
                                value={formData.date}
                                onChange={(value) => handleSelectChange("date", value)}
                                className="min-w-0"
                                required
                            />
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
                                    {categories.map((cat) => (
                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="status">Estado</Label>
                            <Select
                                value={formData.status}
                                onValueChange={(val) => handleSelectChange("status", val)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccione..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Pagada">Pagada</SelectItem>
                                    <SelectItem value="Pendiente">Pendiente</SelectItem>
                                    <SelectItem value="Parcial">Parcial</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2 col-span-2">
                            <Label htmlFor="supplierName">Proveedor / Beneficiario</Label>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <Input
                                        id="supplierName"
                                        name="supplierName"
                                        placeholder="Nombre del proveedor o persona"
                                        value={formData.supplierName}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="w-1/3">
                                    <Select onValueChange={handleContactSelect}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Proveedores" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {providerContacts.map((contact) => (
                                                <SelectItem key={contact.id} value={contact.id}>
                                                    {contact.name}
                                                </SelectItem>
                                            ))}
                                            {providerContacts.length === 0 && (
                                                <SelectItem value="__empty" disabled>
                                                    No hay proveedores
                                                </SelectItem>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="supplierRnc">RNC / Cédula Proveedor</Label>
                            <Input
                                id="supplierRnc"
                                name="supplierRnc"
                                placeholder="9 u 11 dígitos"
                                value={formData.supplierRnc}
                                onChange={handleChange}
                            />
                        </div>

                        {/* e-CF Reporting Section */}
                        <div className="col-span-2 p-3 border rounded-md bg-muted/30 space-y-3">
                            <div className="flex items-center gap-2">
                                <Receipt className="h-4 w-4 text-primary" />
                                <span className="text-sm font-bold">Resumen Fiscal (DGII)</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="ncfType" className="text-xs">Tipo de Comprobante</Label>
                                    <Select
                                        value={formData.ncfType}
                                        onValueChange={(val) => {
                                            handleSelectChange("ncfType", val);
                                            if (['E41', 'E43', 'E47'].includes(val)) {
                                                setFormData(prev => ({ ...prev, ncf: '' }));
                                            }
                                        }}
                                    >
                                        <SelectTrigger className="h-9">
                                            <SelectValue placeholder="Seleccione..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Ninguno">No reportar / Informal</SelectItem>
                                            <SelectItem value="B01">B01 - Cred. Fiscal (Manual)</SelectItem>
                                            <SelectItem value="E31">E31 - Cred. Fiscal (e-CF Recibido)</SelectItem>
                                            <SelectItem value="E41">E41 - Gastos de Compra</SelectItem>
                                            <SelectItem value="E43">E43 - Gastos Menores</SelectItem>
                                            <SelectItem value="E47">E47 - Pagos al Exterior</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="ncf" className="text-xs">No. comprobante / factura</Label>
                                    <Input
                                        id="ncf"
                                        name="ncf"
                                        placeholder={isElectronicExpense ? "AUTOMÁTICO" : "B01, factura o recibo"}
                                        value={formData.ncf}
                                        onChange={handleChange}
                                        disabled={isElectronicExpense}
                                        className="h-9 font-mono uppercase"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2 col-span-2">
                            <Label htmlFor="paymentMethod">Método de Pago</Label>
                            <Select
                                value={formData.paymentMethod}
                                onValueChange={(val) => handleSelectChange("paymentMethod", val)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccione..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Efectivo">Efectivo</SelectItem>
                                    <SelectItem value="Transferencia">Transferencia</SelectItem>
                                    <SelectItem value="Cheque">Cheque</SelectItem>
                                    <SelectItem value="Tarjeta">Tarjeta</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2 col-span-2">
                            <Label>Archivo Adjunto</Label>
                            {!attachment ? (
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="file"
                                        accept="image/*,application/pdf"
                                        onChange={handleFileChange}
                                        disabled={isUploading}
                                        className="cursor-pointer"
                                    />
                                    {isUploading && <Loader2 className="h-4 w-4 animate-spin" />}
                                </div>
                            ) : (
                                <div className="flex items-center justify-between p-2 border rounded-md bg-slate-50">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <div className="h-10 w-10 relative flex-shrink-0 bg-slate-200 rounded overflow-hidden flex items-center justify-center">
                                            {attachment.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                                <Image src={attachment} alt="Preview" fill className="object-cover" />
                                            ) : (
                                                <FileText className="h-6 w-6 text-slate-500" />
                                            )}
                                        </div>
                                        <span className="text-sm truncate">Adjunto cargado</span>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={handleRemoveAttachment}
                                        className="h-8 w-8 text-destructive"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2 col-span-2">
                            <Label htmlFor="notes">Notas</Label>
                            <Textarea
                                id="notes"
                                name="notes"
                                placeholder="..."
                                value={formData.notes}
                                onChange={handleChange}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isLoading || isUploading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Guardar Cambios
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
