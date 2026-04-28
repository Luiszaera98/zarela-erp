'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { updatePayment } from '@/lib/actions/paymentActions';
import { Payment } from '@/types';
import { Loader2 } from 'lucide-react';

interface EditPaymentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    payment: Payment | null;
    onSuccess: () => void;
}

const PAYMENT_METHODS = ["Efectivo", "Transferencia", "Cheque", "Tarjeta"];

export function EditPaymentDialog({ open, onOpenChange, payment, onSuccess }: EditPaymentDialogProps) {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const [amount, setAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('');
    const [paymentDate, setPaymentDate] = useState('');
    const [reference, setReference] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (payment) {
            setAmount(payment.amount.toString());
            setPaymentMethod(payment.paymentMethod);
            // Format date for date input (YYYY-MM-DD)
            const date = new Date(payment.paymentDate);
            setPaymentDate(date.toISOString().split('T')[0]);
            setReference(payment.reference || '');
            setNotes(payment.notes || '');
        }
    }, [payment]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!payment) return;
        if (!amount || parseFloat(amount) <= 0) {
            toast({
                title: "Error",
                description: "El monto debe ser mayor a 0",
                variant: "destructive"
            });
            return;
        }

        setIsLoading(true);

        try {
            const result = await updatePayment(payment.id, {
                amount: parseFloat(amount),
                paymentMethod,
                paymentDate: new Date(paymentDate).toISOString(),
                reference,
                notes
            });

            if (result.success) {
                toast({
                    title: "Pago actualizado",
                    description: "El pago se ha modificado correctamente."
                });
                onSuccess();
                onOpenChange(false);
            } else {
                toast({
                    title: "Error",
                    description: result.message || "No se pudo actualizar el pago",
                    variant: "destructive"
                });
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "Ocurrió un error inesperado",
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    if (!payment) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Editar Pago</DialogTitle>
                    <DialogDescription>
                        Modifique los detalles del pago de la Factura {payment.invoiceNumber}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="amount">Monto</Label>
                        <Input
                            id="amount"
                            type="number"
                            step="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="date">Fecha</Label>
                            <Input
                                id="date"
                                type="date"
                                value={paymentDate}
                                onChange={(e) => setPaymentDate(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="method">Método</Label>
                            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccione..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {PAYMENT_METHODS.map((method) => (
                                        <SelectItem key={method} value={method}>
                                            {method}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="reference">Referencia (Opcional)</Label>
                        <Input
                            id="reference"
                            value={reference}
                            onChange={(e) => setReference(e.target.value)}
                            placeholder="# Transferencia, Cheque..."
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Notas (Opcional)</Label>
                        <Input
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Guardar Cambios
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
