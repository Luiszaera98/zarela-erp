"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { createDebitNote } from '@/lib/actions/paymentActions';
import { getInvoiceById } from '@/lib/actions/invoiceActions';
import { Invoice } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, PlusCircle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CreateDebitNoteDialogProps {
    invoice: Invoice | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function CreateDebitNoteDialog({ invoice, open, onOpenChange, onSuccess }: CreateDebitNoteDialogProps) {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingDetails, setIsFetchingDetails] = useState(false);
    const [fullInvoice, setFullInvoice] = useState<Invoice | null>(null);

    // Form state
    const [reason, setReason] = useState('');
    const [notes, setNotes] = useState('');
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [quantities, setQuantities] = useState<Record<string, number>>({});
    const [codigoModificacion, setCodigoModificacion] = useState<string>('3'); // Default: Montos

    // Determine if original invoice is electronic
    const isElectronic = invoice?.ncfType?.startsWith('E') || false;

    // Fetch full invoice details if items are missing
    useEffect(() => {
        const fetchInvoiceDetails = async () => {
            if (open && invoice) {
                if (!invoice.items || invoice.items.length === 0) {
                    setIsFetchingDetails(true);
                    try {
                        const detailedInvoice = await getInvoiceById(invoice.id);
                        if (detailedInvoice) {
                            setFullInvoice(detailedInvoice);
                        } else {
                            setFullInvoice(invoice);
                        }
                    } catch (error) {
                        console.error("Error fetching invoice details:", error);
                        setFullInvoice(invoice);
                    } finally {
                        setIsFetchingDetails(false);
                    }
                } else {
                    setFullInvoice(invoice);
                }
            } else {
                setFullInvoice(null);
            }
        };

        fetchInvoiceDetails();
    }, [open, invoice]);

    if (!fullInvoice && !invoice) return null;

    const activeInvoice = fullInvoice || invoice!;

    const toggleItem = (itemId: string) => {
        const newSelected = new Set(selectedItems);
        if (newSelected.has(itemId)) {
            newSelected.delete(itemId);
        } else {
            newSelected.add(itemId);
            if (!quantities[itemId]) {
                setQuantities(prev => ({ ...prev, [itemId]: 1 }));
            }
        }
        setSelectedItems(newSelected);
    };

    const updateQuantity = (itemId: string, newQuantity: number) => {
        setQuantities(prev => ({ ...prev, [itemId]: Math.max(0, newQuantity) }));
    };

    const calculateDebitNoteTotal = () => {
        let subtotal = 0;
        let tax = 0;

        if (activeInvoice && activeInvoice.items) {
            activeInvoice.items.forEach(item => {
                if (selectedItems.has(item.id)) {
                    const quantity = quantities[item.id] || 0;
                    const itemSubtotal = quantity * item.price;
                    const itemDiscount = (itemSubtotal * item.discount) / 100;
                    const itemTotal = itemSubtotal - itemDiscount;

                    subtotal += itemTotal;

                    // Pro-rate tax based on original invoice ratio or simplified
                    if (activeInvoice.subtotal > 0) {
                        tax += (itemTotal / activeInvoice.subtotal) * activeInvoice.tax;
                    }
                }
            });
        }

        return { subtotal, tax, total: subtotal + tax };
    };

    const debitTotals = calculateDebitNoteTotal();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!reason.trim()) {
            toast({ title: "Error", description: "Indique el motivo", variant: "destructive" });
            return;
        }

        if (selectedItems.size === 0) {
            toast({ title: "Error", description: "Seleccione al menos un ítem para aumentar valor", variant: "destructive" });
            return;
        }

        setIsLoading(true);

        const itemsToDebit = activeInvoice.items
            .filter(item => selectedItems.has(item.id))
            .map(item => ({
                productId: item.productId,
                productName: item.productName,
                description: item.description,
                itemType: item.itemType,
                quantity: quantities[item.id] || 1,
                price: item.price,
                discount: item.discount
            }));

        try {
            const result = await createDebitNote({
                originalInvoiceId: activeInvoice.id,
                reason: reason.trim(),
                items: itemsToDebit,
                discount: 0,
                tax: debitTotals.tax,
                notes: notes.trim() || undefined,
                codigoModificacion: isElectronic ? (parseInt(codigoModificacion) as 1 | 2 | 3 | 4) : undefined
            });

            setIsLoading(false);

            if (result.success) {
                toast({
                    title: "Éxito",
                    description: `Nota de Débito ${result.debitNote?.ncf} creada correctamente`,
                });
                resetForm();
                onOpenChange(false);
                onSuccess();
            } else {
                toast({
                    title: "Error",
                    description: result.message || "No se pudo crear la nota de débito",
                    variant: "destructive",
                });
            }
        } catch (error: any) {
            console.error("Error creating debit note:", error);
            setIsLoading(false);
            toast({
                title: "Error de Sistema",
                description: "Ocurrió un error al comunicarse con el servidor.",
                variant: "destructive",
            });
        }
    };

    const resetForm = () => {
        setReason('');
        setNotes('');
        setSelectedItems(new Set());
        setQuantities({});
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <PlusCircle className="h-5 w-5 text-indigo-600" />
                        Crear Nota de Débito {isElectronic ? '(e-NCF E33)' : '(NCF B03)'}
                    </DialogTitle>
                    <DialogDescription>
                        Las notas de débito se utilizan para aumentar el valor de una factura emitida previamente.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 p-4 rounded-lg">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                                <span className="text-indigo-700 dark:text-indigo-300 block text-xs">Factura Original</span>
                                <span className="font-semibold">{activeInvoice.number}</span>
                            </div>
                            <div>
                                <span className="text-indigo-700 dark:text-indigo-300 block text-xs">NCF</span>
                                <span className="font-mono font-semibold">{activeInvoice.ncf}</span>
                            </div>
                            <div>
                                <span className="text-indigo-700 dark:text-indigo-300 block text-xs">Saldo Actual</span>
                                <span className="font-semibold">${(activeInvoice.total - activeInvoice.paidAmount).toLocaleString()}</span>
                            </div>
                            <div>
                                <span className="text-indigo-700 dark:text-indigo-300 block text-xs">Cliente</span>
                                <span className="font-semibold truncate block">{activeInvoice.clientName}</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="reason">Motivo de la Nota de Débito *</Label>
                        <Input
                            id="reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Ej: Intereses por mora, Error en precio (menor), Gastos adicionales"
                            required
                        />
                    </div>

                    {isElectronic && (
                        <div className="space-y-2">
                            <Label htmlFor="codigoModificacion">Código de Modificación (DGII) *</Label>
                            <Select value={codigoModificacion} onValueChange={setCodigoModificacion}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">1 — Anula el comprobante modificado</SelectItem>
                                    <SelectItem value="2">2 — Corrige texto</SelectItem>
                                    <SelectItem value="3">3 — Corrige montos</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="space-y-3">
                        <Label>Ítems a Aumentar / Agregar</Label>
                        <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
                            {isFetchingDetails ? (
                                <div className="p-8 flex justify-center items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /></div>
                            ) : (
                                activeInvoice.items.map((item) => {
                                    const isSelected = selectedItems.has(item.id);
                                    return (
                                        <div key={item.id} className={`p-3 transition-colors ${isSelected ? 'bg-indigo-50/50' : 'opacity-60'}`}>
                                            <div className="flex items-center gap-3">
                                                <input type="checkbox" checked={isSelected} onChange={() => toggleItem(item.id)} className="h-4 w-4" />
                                                <div className="flex-1 grid grid-cols-12 gap-2 items-center text-sm">
                                                    <div className="col-span-12 md:col-span-5 font-medium">{item.productName}</div>
                                                    <div className="col-span-6 md:col-span-4 flex items-center gap-2">
                                                        {isSelected && (
                                                            <>
                                                                <span className="text-xs">Cant. adicional:</span>
                                                                <Input type="number" value={quantities[item.id]} onChange={e => updateQuantity(item.id, parseFloat(e.target.value))} className="h-8 w-20 text-right" />
                                                            </>
                                                        )}
                                                    </div>
                                                    <div className="col-span-6 md:col-span-3 text-right font-semibold">
                                                        ${isSelected ? ((quantities[item.id] || 0) * item.price).toLocaleString() : '0.00'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    <div className="bg-muted/30 p-4 rounded-lg space-y-1 text-sm">
                        <div className="flex justify-between"><span>Subtotal Adicional:</span><span>${debitTotals.subtotal.toLocaleString()}</span></div>
                        <div className="flex justify-between"><span>ITBIS Adicional:</span><span>${debitTotals.tax.toLocaleString()}</span></div>
                        <Separator className="my-2" />
                        <div className="flex justify-between text-lg font-bold text-indigo-600">
                            <span>Total a Debitar:</span>
                            <span>${debitTotals.total.toLocaleString()}</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Notas (Opcional)</Label>
                        <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button type="submit" disabled={isLoading || selectedItems.size === 0} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                            {isLoading ? "Procesando..." : "Generar Nota de Débito"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
