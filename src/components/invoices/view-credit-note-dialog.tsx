"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CreditNote } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { EcfStatusBadge } from '@/components/invoices/ecf-action-buttons';
import { ECFStatus } from '@/types';
import { Printer } from 'lucide-react';

interface ViewCreditNoteDialogProps {
    creditNote: CreditNote | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ViewCreditNoteDialog({ creditNote, open, onOpenChange }: ViewCreditNoteDialogProps) {
    if (!creditNote) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader className="flex flex-row items-center justify-between">
                    <DialogTitle className="text-2xl flex items-center gap-2">
                        Nota de Crédito
                        <Badge variant="outline" className="text-lg font-mono">{creditNote.ncf}</Badge>
                        {creditNote.ncfType === 'E34' && (
                            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">e-CF</Badge>
                        )}
                    </DialogTitle>
                    <Button variant="outline" size="sm" onClick={() => window.open(`/invoices/${creditNote.id}/print`, '_blank')}>
                        <Printer className="h-4 w-4 mr-2" />
                        Imprimir
                    </Button>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Header Info */}
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <div>
                                <p className="text-sm text-muted-foreground">Factura Original Afectada</p>
                                <p className="font-semibold text-lg">{creditNote.originalInvoiceNumber}</p>
                                <p className="text-sm font-mono text-muted-foreground">NCF: {creditNote.originalInvoiceNcf}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Cliente</p>
                                <p className="font-semibold">{creditNote.clientName}</p>
                                {creditNote.clientRnc && (
                                    <p className="text-sm text-muted-foreground">RNC/Cédula: {creditNote.clientRnc}</p>
                                )}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <p className="text-sm text-muted-foreground">Fecha de Emisión</p>
                                <p className="font-medium">{format(new Date(creditNote.date), 'dd \'de\' MMMM \'de\' yyyy', { locale: es })}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Motivo</p>
                                <p className="font-medium text-orange-700 dark:text-orange-400">{creditNote.reason}</p>
                            </div>
                            {creditNote.ncfType === 'E34' && creditNote.codigoModificacion && (
                                <div>
                                    <p className="text-sm text-muted-foreground">Código de Modificación DGII</p>
                                    <p className="font-medium">
                                        {creditNote.codigoModificacion} — {{
                                            1: 'Anula el comprobante modificado',
                                            2: 'Corrige texto del comprobante',
                                            3: 'Corrige montos del comprobante',
                                            4: 'Reemplazo NCF emitido en contingencia'
                                        }[creditNote.codigoModificacion]}
                                    </p>
                                </div>
                            )}
                            {creditNote.ecfStatus && (
                                <div>
                                    <p className="text-sm text-muted-foreground mb-1">Estado e-CF</p>
                                    <EcfStatusBadge ecfStatus={creditNote.ecfStatus as ECFStatus} />
                                </div>
                            )}
                        </div>
                    </div>

                    <Separator />

                    {/* Items Table */}
                    <div>
                        <h3 className="font-semibold mb-3">Productos/Servicios Acreditados</h3>
                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-muted/50">
                                    <tr>
                                        <th className="text-left p-3 text-sm font-medium">Producto</th>
                                        <th className="text-right p-3 text-sm font-medium">Cantidad</th>
                                        <th className="text-right p-3 text-sm font-medium">Precio Unit.</th>
                                        <th className="text-right p-3 text-sm font-medium">Desc. %</th>
                                        <th className="text-right p-3 text-sm font-medium">Subtotal</th>
                                        <th className="text-right p-3 text-sm font-medium">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {creditNote.items.map((item) => (
                                        <tr key={item.id} className="border-t">
                                            <td className="p-3">{item.productName}</td>
                                            <td className="p-3 text-right">{item.quantity}</td>
                                            <td className="p-3 text-right">${item.price.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</td>
                                            <td className="p-3 text-right">{item.discount}%</td>
                                            <td className="p-3 text-right">${item.subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</td>
                                            <td className="p-3 text-right font-medium">${item.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Totals */}
                    <div className="flex justify-end">
                        <div className="w-full max-w-sm space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Subtotal Acreditado:</span>
                                <span className="font-medium">${creditNote.subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                            </div>
                            {creditNote.discount > 0 && (
                                <div className="flex justify-between text-sm text-muted-foreground">
                                    <span>Descuento General ({creditNote.discount}%):</span>
                                    <span>-${((creditNote.subtotal * creditNote.discount) / 100).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm">
                                <span>ITBIS Acreditado:</span>
                                <span className="font-medium">${creditNote.tax.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between text-lg font-bold text-orange-600 dark:text-orange-400">
                                <span>Total Nota de Crédito:</span>
                                <span>${creditNote.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    </div>

                    {/* Notes */}
                    {creditNote.notes && (
                        <>
                            <Separator />
                            <div>
                                <p className="text-sm text-muted-foreground mb-2">Notas Adicionales</p>
                                <p className="text-sm bg-muted/30 p-3 rounded-md">{creditNote.notes}</p>
                            </div>
                        </>
                    )}

                    {/* Footer Info */}
                    <div className="text-xs text-muted-foreground pt-4 border-t">
                        <p>Creada: {format(new Date(creditNote.createdAt), 'dd/MM/yyyy HH:mm', { locale: es })}</p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
