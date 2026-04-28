"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { createCreditNote } from '@/lib/actions/paymentActions';
import { getInvoiceById } from '@/lib/actions/invoiceActions';
import { Invoice } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, FileText, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CreateCreditNoteDialogProps {
    invoice: Invoice | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function CreateCreditNoteDialog({ invoice, open, onOpenChange, onSuccess }: CreateCreditNoteDialogProps) {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingDetails, setIsFetchingDetails] = useState(false);
    const [fullInvoice, setFullInvoice] = useState<Invoice | null>(null);

    // Form state
    const [reason, setReason] = useState('');
    const [notes, setNotes] = useState('');
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [quantities, setQuantities] = useState<Record<string, number>>({});
    const [codigoModificacion, setCodigoModificacion] = useState<string>('1');

    // Determine if original invoice is electronic
    const isElectronic = invoice?.ncfType?.startsWith('E') || false;

    // Fetch full invoice details if items are missing
    useEffect(() => {
        const fetchInvoiceDetails = async () => {
            if (open && invoice) {
                // If items are missing or empty, fetch details
                if (!invoice.items || invoice.items.length === 0) {
                    setIsFetchingDetails(true);
                    try {
                        const detailedInvoice = await getInvoiceById(invoice.id);
                        if (detailedInvoice) {
                            setFullInvoice(detailedInvoice);
                            initializeSelection(detailedInvoice);
                        } else {
                            // Fallback to prop invoice even if emptyItems (shouldn't happen if ID is valid)
                            setFullInvoice(invoice);
                        }
                    } catch (error) {
                        console.error("Error fetching invoice details:", error);
                        toast({
                            title: "Error",
                            description: "No se pudieron cargar los detalles de la factura.",
                            variant: "destructive",
                        });
                        setFullInvoice(invoice);
                    } finally {
                        setIsFetchingDetails(false);
                    }
                } else {
                    // Start with prop invoice if it has items
                    setFullInvoice(invoice);
                    initializeSelection(invoice);
                }
            } else {
                setFullInvoice(null);
            }
        };

        fetchInvoiceDetails();
    }, [open, invoice]);

    const initializeSelection = (inv: Invoice) => {
        const initialSelected = new Set(inv.items.map(item => item.id));
        const initialQuantities: Record<string, number> = {};
        inv.items.forEach(item => {
            initialQuantities[item.id] = item.quantity;
        });
        setSelectedItems(initialSelected);
        setQuantities(initialQuantities);
    };

    if (!fullInvoice && !invoice) return null;

    // Use fullInvoice if available, otherwise invoice (though strictly we rely on fullInvoice for items)
    const activeInvoice = fullInvoice || invoice!;

    const toggleItem = (itemId: string) => {
        const newSelected = new Set(selectedItems);
        if (newSelected.has(itemId)) {
            newSelected.delete(itemId);
        } else {
            newSelected.add(itemId);
            // Reset quantity to max when re-selecting
            const item = activeInvoice.items.find(i => i.id === itemId);
            if (item) {
                setQuantities(prev => ({ ...prev, [itemId]: item.quantity }));
            }
        }
        setSelectedItems(newSelected);
    };

    const updateQuantity = (itemId: string, newQuantity: number) => {
        const item = activeInvoice.items.find(i => i.id === itemId);
        if (!item) return;

        // Validate range
        const validQuantity = Math.max(0.01, Math.min(newQuantity, item.quantity));
        setQuantities(prev => ({ ...prev, [itemId]: validQuantity }));
    };

    const calculateCreditNoteTotal = () => {
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

                    if (activeInvoice.subtotal > 0) {
                        tax += (itemTotal / activeInvoice.subtotal) * activeInvoice.tax;
                    }
                }
            });
        }

        return {
            subtotal,
            tax,
            total: subtotal + tax
        };
    };

    const creditTotals = calculateCreditNoteTotal();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!reason.trim()) {
            toast({
                title: "Error",
                description: "Debe indicar el motivo de la nota de crédito",
                variant: "destructive",
            });
            return;
        }

        if (selectedItems.size === 0) {
            toast({
                title: "Error",
                description: "Debe seleccionar al menos un ítem para acreditar",
                variant: "destructive",
            });
            return;
        }

        setIsLoading(true);

        const itemsToCredit = activeInvoice.items
            .filter(item => selectedItems.has(item.id))
            .map(item => ({
                productId: item.productId,
                productName: item.productName,
                description: item.description,
                itemType: item.itemType,
                quantity: quantities[item.id] || item.quantity,
                price: item.price,
                discount: item.discount
            }));

        try {
            const result = await createCreditNote({
                originalInvoiceId: activeInvoice.id,
                reason: reason.trim(),
                items: itemsToCredit,
                discount: 0,
                tax: creditTotals.tax,
                notes: notes.trim() || undefined,
                codigoModificacion: isElectronic ? (parseInt(codigoModificacion) as 1 | 2 | 3 | 4) : undefined
            });

            setIsLoading(false);

            if (result.success) {
                toast({
                    title: "Éxito",
                    description: `Nota de Crédito ${result.creditNote?.ncf} creada correctamente`,
                });
                resetForm();
                onOpenChange(false);
                onSuccess();
            } else {
                toast({
                    title: "Error",
                    description: result.message || "No se pudo crear la nota de crédito",
                    variant: "destructive",
                });
            }
        } catch (error: any) {
            console.error("Error calling server action:", error);
            setIsLoading(false);
            toast({
                title: "Error de Sistema",
                description: "Ocurrió un error inesperado al comunicarse con el servidor.",
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
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        Crear Nota de Crédito {isElectronic ? '(e-NCF E34)' : '(NCF B04)'}
                    </DialogTitle>
                    <DialogDescription>
                        {isElectronic
                            ? 'Se generará una Nota de Crédito Electrónica (E34) que podrá enviarse a la DGII'
                            : 'Seleccione los ítems y ajuste las cantidades a devolver'
                        }
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Original Invoice Reference */}
                    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                            <div className="flex-1 space-y-2">
                                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Factura a Reversar</p>

                                <div className="grid grid-cols-2 md:grid-cols-12 gap-4 text-sm">
                                    <div className="md:col-span-3">
                                        <span className="text-blue-700 dark:text-blue-300 block text-xs">Número</span>
                                        <span className="font-semibold">{activeInvoice.number}</span>
                                    </div>
                                    <div className="md:col-span-3">
                                        <span className="text-blue-700 dark:text-blue-300 block text-xs">NCF</span>
                                        <span className="font-mono font-semibold">{activeInvoice.ncf}</span>
                                    </div>
                                    <div className="md:col-span-3">
                                        <span className="text-blue-700 dark:text-blue-300 block text-xs">Total Original</span>
                                        <span className="font-semibold">${activeInvoice.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="col-span-2 md:col-span-12 min-w-0">
                                        <span className="text-blue-700 dark:text-blue-300 block text-xs">Cliente</span>
                                        <span className="font-semibold truncate block" title={activeInvoice.clientName}>{activeInvoice.clientName}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Reason */}
                    <div className="space-y-2">
                        <Label htmlFor="reason">Motivo de la Nota de Crédito *</Label>
                        <Input
                            id="reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Ej: Devolución parcial, Error en precio, Mercancía dañada"
                            required
                        />
                    </div>

                    <Separator />

                    {/* Código de Modificación (only for E34) */}
                    {isElectronic && (
                        <div className="space-y-2">
                            <Label htmlFor="codigoModificacion">Código de Modificación (DGII) *</Label>
                            <Select value={codigoModificacion} onValueChange={setCodigoModificacion}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccione el motivo" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">1 — Anula el comprobante modificado</SelectItem>
                                    <SelectItem value="2">2 — Corrige texto del comprobante</SelectItem>
                                    <SelectItem value="3">3 — Corrige montos del comprobante</SelectItem>
                                    <SelectItem value="4">4 — Reemplazo NCF emitido en contingencia</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                Requerido por la DGII para Notas de Crédito Electrónicas (E34)
                            </p>
                        </div>
                    )}

                    {/* Items Selection */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <Label>Ítems a Acreditar</Label>
                            <span className="text-xs text-muted-foreground">
                                {selectedItems.size} ítems seleccionados
                            </span>
                        </div>

                        <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
                            {isFetchingDetails ? (
                                <div className="p-8 flex justify-center items-center text-muted-foreground gap-2">
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    <span>Cargando detalles de la factura...</span>
                                </div>
                            ) : (
                                activeInvoice.items && activeInvoice.items.length > 0 ? (
                                    activeInvoice.items.map((item) => {
                                        const isSelected = selectedItems.has(item.id);
                                        const currentQty = quantities[item.id] || item.quantity;
                                        const itemTotal = (currentQty * item.price) * (1 - item.discount / 100);

                                        return (
                                            <div key={item.id} className={`p-3 transition-colors ${isSelected ? 'bg-muted/50' : 'opacity-60 hover:opacity-100'}`}>
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="checkbox"
                                                        id={`item-${item.id}`}
                                                        checked={isSelected}
                                                        onChange={() => toggleItem(item.id)}
                                                        className="h-4 w-4 rounded border-gray-300"
                                                    />

                                                    <div className="flex-1 grid grid-cols-12 gap-2 items-center">
                                                        <label htmlFor={`item-${item.id}`} className="col-span-12 md:col-span-4 cursor-pointer">
                                                            <p className="font-medium text-sm truncate" title={item.productName}>{item.productName}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                Original: {item.quantity} un.
                                                            </p>
                                                        </label>

                                                        <div className="col-span-6 md:col-span-4 flex justify-start md:justify-center">
                                                            {isSelected && (
                                                                <div className="flex items-center gap-2">
                                                                    <Label className="text-xs whitespace-nowrap">Devolver:</Label>
                                                                    <Input
                                                                        type="number"
                                                                        min="0.01"
                                                                        max={item.quantity}
                                                                        step="0.01"
                                                                        value={currentQty}
                                                                        onChange={(e) => updateQuantity(item.id, parseFloat(e.target.value) || 0)}
                                                                        className="h-8 w-20 text-right"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="col-span-3 md:col-span-2 text-right text-sm">
                                                            ${item.price.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                                                        </div>

                                                        <div className="col-span-3 md:col-span-2 text-right font-semibold text-sm">
                                                            ${isSelected ? itemTotal.toLocaleString('es-DO', { minimumFractionDigits: 2 }) : '0.00'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="p-4 text-center text-muted-foreground text-sm">
                                        No hay ítems disponibles para esta factura.
                                    </div>
                                )
                            )}
                        </div>
                    </div>

                    {/* Credit Note Totals */}
                    <div className="bg-muted/30 p-4 rounded-lg space-y-2">
                        <div className="flex justify-between items-center mb-2">
                            <p className="font-medium">Resumen de Devolución</p>
                            {creditTotals.total >= activeInvoice.total && (
                                <Badge variant="destructive" className="text-xs">Devolución Total</Badge>
                            )}
                        </div>

                        <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                                <span>Subtotal:</span>
                                <span>${creditTotals.subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>ITBIS (Estimado):</span>
                                <span>${creditTotals.tax.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>

                        <Separator className="my-2" />

                        <div className="flex justify-between text-lg font-bold text-primary">
                            <span>Total a Acreditar:</span>
                            <span>${creditTotals.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                        <Label htmlFor="notes">Notas Adicionales (Opcional)</Label>
                        <Textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Información adicional..."
                            rows={2}
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isLoading || selectedItems.size === 0}>
                            {isLoading ? "Procesando..." : "Generar Nota de Crédito"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
