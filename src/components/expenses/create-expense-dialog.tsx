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
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/hooks/use-toast";
import { createExpense } from "@/lib/actions/expenseActions";
import { getContacts } from "@/lib/actions/clientActions";
import { uploadFile } from "@/lib/actions/uploadActions";
import { getExpenseCategories } from "@/lib/actions/settingsActions";
import { ExpenseCategory } from "@/types";
import { PlusCircle, Loader2, X, FileText, Receipt } from "lucide-react";
import Image from "next/image";

interface CreateExpenseDialogProps {
    onSuccess?: () => void;
}

export function CreateExpenseDialog({ onSuccess }: CreateExpenseDialogProps) {
    const [open, setOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const [contacts, setContacts] = useState<{ id: string; name: string; type: string; rncCedula?: string }[]>([]);
    const [categories, setCategories] = useState<string[]>([]);

    // File Upload State
    const [attachment, setAttachment] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const [formData, setFormData] = useState({
        description: "",
        amount: "",
        category: "Otros" as ExpenseCategory,
        date: new Date().toISOString().split('T')[0],
        supplierName: "",
        supplierRnc: "",
        invoiceNumber: "",
        status: "Pendiente" as "Pagada" | "Pendiente",
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

            const result = await createExpense({
                description: formData.description,
                amount: parseFloat(formData.amount),
                category: formData.category,
                date: formData.date,
                supplierName: formData.supplierName,
                supplierRnc: formData.supplierRnc || undefined,
                invoiceNumber: formData.ncf || undefined,
                status: formData.status,
                paymentMethod: formData.paymentMethod as any,
                notes: formData.notes,
                attachments: attachment ? [attachment] : [],
                ncfType: formData.ncfType !== 'Ninguno' ? formData.ncfType : undefined,
                ncf: formData.ncf || undefined,
            });

            if (result.success) {
                toast({
                    title: "Gasto registrado",
                    description: "El gasto se ha guardado correctamente.",
                });
                setOpen(false);
                setFormData({
                    description: "",
                    amount: "",
                    category: "Otros",
                    date: new Date().toISOString().split('T')[0],
                    supplierName: "",
                    supplierRnc: "",
                    invoiceNumber: "",
                    status: "Pendiente",
                    paymentMethod: "Efectivo",
                    notes: "",
                    ncfType: "Ninguno",
                    ncf: ""
                });
                setAttachment(null);
                if (onSuccess) onSuccess();
            } else {
                toast({
                    title: "Error",
                    description: result.message || "No se pudo registrar el gasto.",
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
    const isPaidExpense = formData.status === 'Pagada';
    const providerContacts = contacts.filter(contact => contact.type === 'Proveedor');

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" /> Registrar Gasto
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[760px] max-h-[90vh] overflow-hidden p-0">
                <DialogHeader>
                    <div className="border-b bg-muted/40 px-6 py-5">
                        <DialogTitle>Registrar Nuevo Gasto</DialogTitle>
                        <DialogDescription>
                            Complete los detalles del egreso. Presione guardar al finalizar.
                        </DialogDescription>
                    </div>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="flex max-h-[calc(90vh-96px)] flex-col">
                    <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
                        <section className="grid gap-4 rounded-md border bg-card p-4 md:grid-cols-12">
                            <div className="space-y-2 md:col-span-6">
                                <Label htmlFor="description">Descripción / Concepto</Label>
                                <Input
                                    id="description"
                                    name="description"
                                    placeholder="Ej: Pago de alquiler, insumos, mantenimiento..."
                                    value={formData.description}
                                    onChange={handleChange}
                                    required
                                />
                            </div>

                            <div className="space-y-2 md:col-span-3">
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

                            <div className="space-y-2 md:col-span-3 min-w-0">
                                <Label htmlFor="date">Fecha</Label>
                                <DatePicker
                                    id="date"
                                    value={formData.date}
                                    onChange={(value) => handleSelectChange("date", value)}
                                    className="min-w-0"
                                    required
                                />
                            </div>
                        </section>

                        <section className="grid gap-4 rounded-md border bg-card p-4 md:grid-cols-12">
                            <div className="space-y-2 md:col-span-4">
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

                            <div className="space-y-2 md:col-span-4">
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
                                    </SelectContent>
                                </Select>
                            </div>

                            {isPaidExpense && (
                                <div className="space-y-2 md:col-span-4">
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
                            )}

                            <div className="space-y-2 md:col-span-7">
                                <Label htmlFor="supplierName">Proveedor / Beneficiario</Label>
                                <div className="grid gap-2 md:grid-cols-[1fr_180px]">
                                    <Input
                                        id="supplierName"
                                        name="supplierName"
                                        placeholder="Nombre del proveedor o persona"
                                        value={formData.supplierName}
                                        onChange={handleChange}
                                    />
                                    <Select onValueChange={handleContactSelect}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Desde proveedores" />
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

                            <div className="space-y-2 md:col-span-5">
                                <Label htmlFor="supplierRnc">RNC / Cédula Proveedor</Label>
                                <Input
                                    id="supplierRnc"
                                    name="supplierRnc"
                                    placeholder="9 u 11 dígitos"
                                    value={formData.supplierRnc}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="space-y-2 md:col-span-12">
                                <Label htmlFor="notes">Notas</Label>
                                <Textarea
                                    id="notes"
                                    name="notes"
                                    placeholder="Detalle interno, observaciones o soporte breve..."
                                    value={formData.notes}
                                    onChange={handleChange}
                                    className="min-h-[92px]"
                                />
                            </div>
                        </section>

                        <section className="grid gap-4 rounded-md border bg-muted/30 p-4 md:grid-cols-12">
                            <div className="md:col-span-12 flex items-center gap-2">
                                <Receipt className="h-4 w-4 text-primary" />
                                <span className="text-sm font-semibold">Reporte Fiscal (DGII)</span>
                            </div>

                            <div className="space-y-2 md:col-span-6">
                                <Label htmlFor="ncfType">Tipo de Comprobante</Label>
                                <Select
                                    value={formData.ncfType}
                                    onValueChange={(val) => {
                                        handleSelectChange("ncfType", val);
                                        if (['E41', 'E43', 'E47'].includes(val)) {
                                            setFormData(prev => ({ ...prev, ncf: '' }));
                                        }
                                    }}
                                >
                                    <SelectTrigger>
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

                            <div className="space-y-2 md:col-span-6">
                                <Label htmlFor="ncf">No. comprobante / factura</Label>
                                <Input
                                    id="ncf"
                                    name="ncf"
                                    placeholder={isElectronicExpense ? "AUTOMÁTICO" : "B01, factura o recibo"}
                                    value={formData.ncf}
                                    onChange={handleChange}
                                    disabled={isElectronicExpense}
                                    className="font-mono uppercase"
                                />
                            </div>

                            <div className="md:col-span-12 rounded-md border border-dashed bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                                {formData.ncfType === 'E41'
                                    ? 'E41 requiere RNC o cédula del proveedor para poder enviarse a DGII.'
                                    : isElectronicExpense
                                        ? 'Los comprobantes electrónicos de gasto generan su e-NCF automáticamente.'
                                        : 'Si no reportas este gasto a DGII, puedes dejar el comprobante como "No reportar / Informal".'}
                            </div>
                        </section>

                        <section className="space-y-2 rounded-md border bg-card p-4">
                            <Label>Archivo Adjunto (Opcional)</Label>
                            {!attachment ? (
                                <div className="flex flex-col gap-2 md:flex-row md:items-center">
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
                                <div className="flex items-center justify-between rounded-md border bg-muted/30 p-2">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded bg-slate-200">
                                            {attachment.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                                <Image src={attachment} alt="Preview" fill className="object-cover" />
                                            ) : (
                                            <FileText className="h-6 w-6 text-muted-foreground" />
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
                        </section>
                    </div>

                    <DialogFooter className="border-t bg-background px-6 py-4">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isLoading || isUploading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Guardar Gasto
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
