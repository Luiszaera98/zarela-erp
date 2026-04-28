"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createPayment } from '@/lib/actions/paymentActions';
import { Invoice, PaymentMethod } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { DollarSign } from 'lucide-react';

interface RegisterPaymentDialogProps {
    invoice: Invoice | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

const PAYMENT_METHODS: PaymentMethod[] = ['Efectivo', 'Transferencia', 'Cheque', 'Tarjeta'];

export function RegisterPaymentDialog({ invoice, open, onOpenChange, onSuccess }: RegisterPaymentDialogProps) {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    // Form state
    const [amount, setAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Efectivo');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [reference, setReference] = useState('');
    const [notes, setNotes] = useState('');

    if (!invoice) return null;

    const remainingBalance = invoice.total - invoice.paidAmount;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const paymentAmount = parseFloat(amount);

        if (!paymentAmount || paymentAmount <= 0) {
            toast({
                title: "Error",
                description: "Ingrese un monto válido",
                variant: "destructive",
            });
            return;
        }

        if (paymentAmount > remainingBalance) {
            toast({
                title: "Error",
                description: "El monto excede el saldo pendiente",
                variant: "destructive",
            });
            return;
        }

        setIsLoading(true);

        const result = await createPayment({
            invoiceId: invoice.id,
            invoiceNumber: invoice.number,
            amount: paymentAmount,
            paymentMethod,
            paymentDate: new Date(paymentDate).toISOString(),
            reference: reference || undefined,
            notes: notes || undefined,
            createdBy: 'current-user' // In real app, get from session
        });

        setIsLoading(false);

        if (result.success) {
            toast({
                title: "Éxito",
                description: `Pago registrado correctamente. Restante: $${(remainingBalance - paymentAmount).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`,
            });
            resetForm();
            onOpenChange(false);
            onSuccess();
        } else {
            toast({
                title: "Error",
                description: result.message || "No se pudo registrar el pago",
                variant: "destructive",
            });
        }
    };

    const resetForm = () => {
        setAmount('');
        setPaymentMethod('Efectivo');
        setPaymentDate(new Date().toISOString().split('T')[0]);
        setReference('');
        setNotes('');
    };

    const handleAmountChange = (value: string) => {
        // Only allow numbers and one decimal point
        if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
            setAmount(value);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-primary" />
                        Registrar Pago
                    </DialogTitle>
                    <DialogDescription>
                        Factura: <strong>{invoice.number}</strong> (NCF: {invoice.ncf})
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Invoice Summary */}
                    <div className="bg-muted/30 p-4 rounded-lg space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Total Factura:</span>
                            <span className="font-semibold">${invoice.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Pagado:</span>
                            <span className="text-green-600 font-semibold">${invoice.paidAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-base border-t pt-2">
                            <span className="font-medium">Saldo Pendiente:</span>
                            <span className="text-lg font-bold text-primary">${remainingBalance.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>

                    {/* Payment Amount */}
                    <div className="space-y-2">
                        <Label htmlFor="amount">Monto del Pago *</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                                id="amount"
                                type="text"
                                inputMode="decimal"
                                value={amount}
                                onChange={(e) => handleAmountChange(e.target.value)}
                                placeholder="0.00"
                                className="pl-7"
                                required
                            />
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setAmount(remainingBalance.toString())}
                            className="w-full"
                        >
                            Pagar Saldo Completo
                        </Button>
                    </div>

                    {/* Payment Method */}
                    <div className="space-y-2">
                        <Label htmlFor="paymentMethod">Método de Pago *</Label>
                        <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {PAYMENT_METHODS.map(method => (
                                    <SelectItem key={method} value={method}>{method}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Payment Date */}
                    <div className="space-y-2">
                        <Label htmlFor="paymentDate">Fecha de Pago *</Label>
                        <Input
                            id="paymentDate"
                            type="date"
                            value={paymentDate}
                            onChange={(e) => setPaymentDate(e.target.value)}
                            required
                        />
                    </div>

                    {/* Reference (optional for transfers/checks) */}
                    {(paymentMethod === 'Transferencia' || paymentMethod === 'Cheque') && (
                        <div className="space-y-2">
                            <Label htmlFor="reference">
                                {paymentMethod === 'Transferencia' ? 'Número de Transferencia' : 'Número de Cheque'}
                            </Label>
                            <Input
                                id="reference"
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                                placeholder={paymentMethod === 'Transferencia' ? 'Ej: TRANS-123456' : 'Ej: CHK-789'}
                            />
                        </div>
                    )}

                    {/* Notes */}
                    <div className="space-y-2">
                        <Label htmlFor="notes">Notas (Opcional)</Label>
                        <Textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Información adicional sobre el pago"
                            rows={2}
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? "Registrando..." : "Registrar Pago"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
