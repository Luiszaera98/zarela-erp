"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Printer } from 'lucide-react';

interface ViewDebitNoteDialogProps {
    debitNote: any | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ViewDebitNoteDialog({ debitNote, open, onOpenChange }: ViewDebitNoteDialogProps) {
    if (!debitNote) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader className="flex flex-row items-center justify-between">
                    <DialogTitle className="text-2xl flex items-center gap-2">
                        Nota de Debito
                        <Badge variant="outline" className="text-lg font-mono">{debitNote.ncf}</Badge>
                        {debitNote.ncfType === 'E33' && (
                            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">e-CF</Badge>
                        )}
                    </DialogTitle>
                    <Button variant="outline" size="sm" onClick={() => window.open(`/invoices/${debitNote.id}/print`, '_blank')}>
                        <Printer className="h-4 w-4 mr-2" />
                        Imprimir
                    </Button>
                </DialogHeader>

                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <div>
                                <p className="text-sm text-muted-foreground">Factura Original Afectada</p>
                                <p className="font-semibold text-lg">{debitNote.originalInvoiceNumber}</p>
                                <p className="text-sm font-mono text-muted-foreground">NCF: {debitNote.originalInvoiceNcf}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Cliente</p>
                                <p className="font-semibold">{debitNote.clientName}</p>
                                {debitNote.clientRnc && (
                                    <p className="text-sm text-muted-foreground">RNC/Cedula: {debitNote.clientRnc}</p>
                                )}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <p className="text-sm text-muted-foreground">Fecha de Emision</p>
                                <p className="font-medium">{format(new Date(debitNote.date), "dd 'de' MMMM 'de' yyyy", { locale: es })}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Motivo</p>
                                <p className="font-medium text-indigo-700 dark:text-indigo-400">{debitNote.reason}</p>
                            </div>
                            {debitNote.ncfType === 'E33' && debitNote.codigoModificacion && (
                                <div>
                                    <p className="text-sm text-muted-foreground">Codigo de Modificacion DGII</p>
                                    <p className="font-medium">
                                        {debitNote.codigoModificacion} - {{
                                            1: 'Anula el comprobante modificado',
                                            2: 'Corrige texto del comprobante',
                                            3: 'Corrige montos del comprobante',
                                            4: 'Reemplazo NCF emitido en contingencia'
                                        }[debitNote.codigoModificacion as 1 | 2 | 3 | 4]}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    <Separator />

                    <div>
                        <h3 className="font-semibold mb-3">Productos/Servicios Debitados</h3>
                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-muted/50">
                                    <tr>
                                        <th className="text-left p-3 text-sm font-medium">Producto/Servicio</th>
                                        <th className="text-right p-3 text-sm font-medium">Cantidad</th>
                                        <th className="text-right p-3 text-sm font-medium">Precio Unit.</th>
                                        <th className="text-right p-3 text-sm font-medium">Desc. %</th>
                                        <th className="text-right p-3 text-sm font-medium">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(debitNote.items || []).map((item: any) => (
                                        <tr key={item.id || item.productId} className="border-t">
                                            <td className="p-3">
                                                <span className="block">{item.productName}</span>
                                                {item.description && <span className="block text-xs text-muted-foreground">{item.description}</span>}
                                            </td>
                                            <td className="p-3 text-right">{item.quantity}</td>
                                            <td className="p-3 text-right">${item.price.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</td>
                                            <td className="p-3 text-right">{item.discount}%</td>
                                            <td className="p-3 text-right font-medium">${item.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <div className="w-full max-w-sm space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Subtotal Debitado:</span>
                                <span className="font-medium">${debitNote.subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span>ITBIS Debitado:</span>
                                <span className="font-medium">${debitNote.tax.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between text-lg font-bold text-indigo-600 dark:text-indigo-400">
                                <span>Total Nota de Debito:</span>
                                <span>${debitNote.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    </div>

                    {debitNote.notes && (
                        <>
                            <Separator />
                            <div>
                                <p className="text-sm text-muted-foreground mb-2">Notas Adicionales</p>
                                <p className="text-sm bg-muted/30 p-3 rounded-md">{debitNote.notes}</p>
                            </div>
                        </>
                    )}

                    <div className="text-xs text-muted-foreground pt-4 border-t">
                        <p>Creada: {format(new Date(debitNote.createdAt), 'dd/MM/yyyy HH:mm', { locale: es })}</p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
