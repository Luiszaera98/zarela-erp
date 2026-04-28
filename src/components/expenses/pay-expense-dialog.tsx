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
import { useToast } from "@/hooks/use-toast";
import { registerExpensePayment } from "@/lib/actions/expenseActions";
import { uploadFile } from "@/lib/actions/uploadActions";
import { Expense } from "@/types";
import { Loader2, Paperclip, X } from "lucide-react";
import Image from "next/image";

interface PayExpenseDialogProps {
    expense: Expense | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function PayExpenseDialog({ expense, open, onOpenChange, onSuccess }: PayExpenseDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        amount: "",
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: "Efectivo",
    });

    const [attachment, setAttachment] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        if (open && expense) {
            const pendingAmount = expense.amount - (expense.paidAmount || 0);
            setFormData({
                amount: pendingAmount > 0 ? pendingAmount.toFixed(2) : "0.00",
                paymentDate: new Date().toISOString().split('T')[0],
                paymentMethod: "Efectivo",
            });
            setAttachment(null);
        }
    }, [open, expense]);

    const handleSelectChange = (name: string, value: string) => {
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
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
                toast({ title: "Archivo subido correctamente" });
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!expense) return;

        setIsLoading(true);

        try {
            const amountToPay = parseFloat(formData.amount);
            if (isNaN(amountToPay) || amountToPay <= 0) {
                toast({
                    title: "Error",
                    description: "Ingrese un monto válido mayor a 0.",
                    variant: "destructive",
                });
                setIsLoading(false);
                return;
            }

            const result = await registerExpensePayment(
                expense.id,
                amountToPay,
                formData.paymentMethod,
                formData.paymentDate,
                attachment ? [attachment] : []
            );

            if (result.success) {
                toast({
                    title: "Pago registrado",
                    description: "El pago se ha registrado correctamente.",
                });
                onSuccess();
                onOpenChange(false);
            } else {
                toast({
                    title: "Error",
                    description: result.message || "No se pudo registrar el pago.",
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

    if (!expense) return null;

    const paidAmount = expense.paidAmount || 0;
    const pendingAmount = expense.amount - paidAmount;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Registrar Pago de Gasto</DialogTitle>
                    <DialogDescription>
                        Registrar un pago para: <strong>{expense.description}</strong>
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="grid grid-cols-3 gap-2 text-center text-sm mb-4">
                        <div className="bg-muted p-2 rounded">
                            <div className="text-muted-foreground">Total</div>
                            <div className="font-bold">${expense.amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</div>
                        </div>
                        <div className="bg-green-50 text-green-700 p-2 rounded">
                            <div className="opacity-80">Pagado</div>
                            <div className="font-bold">${paidAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</div>
                        </div>
                        <div className="bg-red-50 text-red-700 p-2 rounded">
                            <div className="opacity-80">Pendiente</div>
                            <div className="font-bold">${pendingAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</div>
                        </div>
                    </div>

                    <div className="grid gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="amount">Monto a Pagar</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                <Input
                                    id="amount"
                                    name="amount"
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    max={pendingAmount + 0.01} // Allow slight tolerance
                                    className="pl-7 font-bold text-lg"
                                    value={formData.amount}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="paymentDate">Fecha de Pago</Label>
                            <Input
                                id="paymentDate"
                                name="paymentDate"
                                type="date"
                                value={formData.paymentDate}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="space-y-2">
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

                        {/* File Upload Section */}
                        <div className="space-y-2">
                            <Label>Comprobante (Opcional)</Label>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="w-full text-muted-foreground"
                                    onClick={() => document.getElementById('file-upload')?.click()}
                                    disabled={isUploading}
                                >
                                    {isUploading ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Paperclip className="mr-2 h-4 w-4" />
                                    )}
                                    {attachment ? "Cambiar Archivo" : "Adjuntar Comprobante"}
                                </Button>
                                <input
                                    id="file-upload"
                                    type="file"
                                    accept="image/*,.pdf"
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                            </div>
                            {attachment && (
                                <div className="relative mt-2 p-2 border rounded-md bg-slate-50 flex items-center justify-between">
                                    <span className="text-xs text-blue-600 truncate max-w-[200px]">
                                        {attachment.split('/').pop()}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-slate-400 hover:text-red-500"
                                        onClick={() => setAttachment(null)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isLoading || isUploading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Registrar Pago
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
