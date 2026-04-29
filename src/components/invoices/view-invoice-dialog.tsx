"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Invoice } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface ViewInvoiceDialogProps {
    invoice: Invoice | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

import { getCreditNotesByInvoice, getDebitNotesByInvoice } from '@/lib/actions/paymentActions';
import { CreditNote } from '@/types';
import { ViewCreditNoteDialog } from './view-credit-note-dialog';
import { ViewDebitNoteDialog } from './view-debit-note-dialog';
import { FileText, ArrowUpRight, Printer, Trash2, FileDown, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { deleteCreditNote, deleteDebitNote } from '@/lib/actions/paymentActions';
import { useToast } from '@/hooks/use-toast';
import { EmailIcon, WhatsAppIcon } from '@/components/share-icons';
import { shareInvoicePdf } from '@/lib/pdf/sharePdf';

export function ViewInvoiceDialog({ invoice, open, onOpenChange }: ViewInvoiceDialogProps) {
    const [creditNotes, setCreditNotes] = React.useState<CreditNote[]>([]);
    const [selectedCreditNote, setSelectedCreditNote] = React.useState<CreditNote | null>(null);
    const [showCreditNoteDialog, setShowCreditNoteDialog] = React.useState(false);
    const [debitNotes, setDebitNotes] = React.useState<any[]>([]);
    const [selectedDebitNote, setSelectedDebitNote] = React.useState<any | null>(null);
    const [showDebitNoteDialog, setShowDebitNoteDialog] = React.useState(false);
    const { toast } = useToast();

    const handleDeleteCreditNote = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm('¿Estás seguro de eliminar esta nota de crédito?')) {
            const result = await deleteCreditNote(id);
            if (result.success) {
                setCreditNotes(prev => prev.filter(n => n.id !== id));
                toast({ title: 'Nota de crédito eliminada' });
            } else {
                toast({ title: 'Error', description: result.message, variant: 'destructive' });
            }
        }
    };

    const handleDeleteDebitNote = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm('¿Estás seguro de eliminar esta nota de débito?')) {
            const result = await deleteDebitNote(id);
            if (result.success) {
                setDebitNotes(prev => prev.filter(n => n.id !== id));
                toast({ title: 'Nota de débito eliminada' });
            } else {
                toast({ title: 'Error', description: result.message, variant: 'destructive' });
            }
        }
    };

    const [fullInvoice, setFullInvoice] = React.useState<Invoice | null>(null);

    React.useEffect(() => {
        if (open && invoice) {
            const fetchData = async () => {
                try {
                    // Fetch full invoice details to get items
                    const { getInvoiceById } = await import('@/lib/actions/invoiceActions');
                    const fetchedInvoice = await getInvoiceById(invoice.id);
                    setFullInvoice(fetchedInvoice);

                    const notes = await getCreditNotesByInvoice(invoice.id);
                    setCreditNotes(notes);

                    const debits = await getDebitNotesByInvoice(invoice.id);
                    setDebitNotes(debits);
                } catch (error) {
                    console.error("Error fetching data:", error);
                }
            };
            fetchData();
        } else {
            setFullInvoice(null);
        }
    }, [open, invoice]);

    const displayInvoice = fullInvoice || invoice;

    if (!displayInvoice) return null;

    const handleShareInvoice = async (_channel: 'whatsapp' | 'email') => {
        try {
            const result = await shareInvoicePdf(displayInvoice.id);
            toast({
                title: result.shared ? "PDF listo para enviar" : "PDF descargado",
                description: result.shared
                    ? "Elija WhatsApp o correo en el panel de compartir."
                    : "Adjunte el PDF descargado en WhatsApp o correo.",
            });
        } catch (error) {
            toast({ title: "Error", description: "No se pudo generar el PDF", variant: "destructive" });
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'Pagada': return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Pagada</Badge>;
            case 'Pendiente': return <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">Pendiente</Badge>;
            case 'Vencida': return <Badge variant="destructive">Vencida</Badge>;
            case 'Anulada': return <Badge variant="outline">Anulada</Badge>;
            case 'Parcial': return <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">Parcial</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
                    <DialogHeader className="flex flex-row items-center justify-between">
                        <DialogTitle className="text-2xl">Factura {displayInvoice.number}</DialogTitle>
                        <div className="flex items-center gap-2">
                            {displayInvoice.encf && displayInvoice.ncfType?.startsWith('E') && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => window.open(`/api/ecf/ri/${displayInvoice.id}`, '_blank')}
                                    className="text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-950"
                                >
                                    <FileDown className="h-4 w-4 mr-2" />
                                    Descargar RI
                                </Button>
                            )}
                            <Button variant="outline" size="sm" onClick={() => window.open(`/invoices/${displayInvoice.id}/print`, '_blank')}>
                                <Printer className="h-4 w-4 mr-2" />
                                Imprimir
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleShareInvoice('whatsapp')}>
                                <WhatsAppIcon className="h-4 w-4 mr-2 text-green-600" />
                                WhatsApp
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleShareInvoice('email')}>
                                <EmailIcon className="h-4 w-4 mr-2 text-blue-600" />
                                Correo
                            </Button>
                        </div>
                    </DialogHeader>

                    <div className="space-y-6">
                        {/* Header Info */}
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <div>
                                    <p className="text-sm text-muted-foreground">NCF</p>
                                    <p className="font-mono text-lg font-semibold">{displayInvoice.ncf || 'N/A'}</p>
                                    {displayInvoice.ncfType && (
                                        <p className="text-sm text-muted-foreground">{displayInvoice.ncfType}</p>
                                    )}
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Cliente</p>
                                    <p className="font-semibold">{displayInvoice.clientName}</p>
                                    {displayInvoice.clientRnc && (
                                        <p className="text-sm text-muted-foreground">RNC/Cédula: {displayInvoice.clientRnc}</p>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <p className="text-sm text-muted-foreground">Fecha de Emisión</p>
                                    <p className="font-medium">{format(new Date(displayInvoice.date), 'dd \'de\' MMMM \'de\' yyyy', { locale: es })}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Vencimiento</p>
                                    <p className="font-medium">{format(new Date(displayInvoice.dueDate), 'dd \'de\' MMMM \'de\' yyyy', { locale: es })}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Estado</p>
                                    <div className="mt-1">{getStatusBadge(displayInvoice.status)}</div>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Vendedor</p>
                                    <p className="font-medium">{displayInvoice.soldBy || 'N/A'}</p>
                                    {displayInvoice.sellerEmail && (
                                        <p className="text-xs text-muted-foreground">{displayInvoice.sellerEmail}</p>
                                    )}
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Condición de Pago</p>
                                    <p className="font-medium">{displayInvoice.paymentTerms || 'N/A'}</p>
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* Items Table */}
                        <div>
                            <h3 className="font-semibold mb-3">Productos/Servicios</h3>
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
                                        {displayInvoice.items && displayInvoice.items.length > 0 ? (
                                            displayInvoice.items.map((item) => (
                                                <tr key={item.id} className="border-t">
                                                    <td className="p-3">
                                                        <span className="block">{item.productName}</span>
                                                        {item.description && <span className="block text-xs text-muted-foreground">{item.description}</span>}
                                                    </td>
                                                    <td className="p-3 text-right">{item.quantity}</td>
                                                    <td className="p-3 text-right">${item.price.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</td>
                                                    <td className="p-3 text-right">{item.discount}%</td>
                                                    <td className="p-3 text-right">${item.subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</td>
                                                    <td className="p-3 text-right font-medium">${item.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={6} className="p-4 text-center text-muted-foreground">
                                                    Cargando productos...
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Debit Notes Section */}
                        {debitNotes.length > 0 && (
                            <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900 rounded-lg p-4">
                                <h3 className="font-semibold text-indigo-800 dark:text-indigo-400 mb-3 flex items-center gap-2">
                                    <PlusCircle className="h-4 w-4" />
                                    Notas de Débito Aplicadas (Aumento de Valor)
                                </h3>
                                <div className="space-y-2">
                                    {debitNotes.map(note => (
                                        <div
                                            key={note.id}
                                            className="flex items-center justify-between bg-white dark:bg-card p-3 rounded border border-indigo-100 dark:border-indigo-900/50 cursor-pointer hover:shadow-sm transition-shadow"
                                            onClick={() => {
                                                setSelectedDebitNote(note);
                                                setShowDebitNoteDialog(true);
                                            }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <Badge variant="outline" className="font-mono bg-indigo-50 text-indigo-700 border-indigo-200">{note.ncf}</Badge>
                                                <span className="text-sm font-medium">{note.number}</span>
                                                <span className="text-sm font-medium">{format(new Date(note.date), 'dd/MM/yyyy')}</span>
                                                <span className="text-sm text-muted-foreground truncate max-w-[200px]">- {note.reason}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="font-bold text-indigo-600 dark:text-indigo-400">+${note.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                                                <Button variant="outline" size="icon" className="h-8 w-8 text-destructive border-destructive/50 hover:bg-destructive/10" onClick={(e) => handleDeleteDebitNote(e, note.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Credit Notes Section */}
                        {creditNotes.length > 0 && (
                            <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 rounded-lg p-4">
                                <h3 className="font-semibold text-orange-800 dark:text-orange-400 mb-3 flex items-center gap-2">
                                    <FileText className="h-4 w-4" />
                                    Notas de Crédito Aplicadas
                                </h3>
                                <div className="space-y-2">
                                    {creditNotes.map(note => (
                                        <div
                                            key={note.id}
                                            className="flex items-center justify-between bg-white dark:bg-card p-3 rounded border border-orange-100 dark:border-orange-900/50 cursor-pointer hover:shadow-sm transition-shadow"
                                            onClick={() => {
                                                setSelectedCreditNote(note);
                                                setShowCreditNoteDialog(true);
                                            }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <Badge variant="outline" className="font-mono bg-orange-50 text-orange-700 border-orange-200">{note.ncf}</Badge>
                                                <span className="text-sm font-medium">{note.number || 'Sin Número'}</span>
                                                <span className="text-sm font-medium">{format(new Date(note.date), 'dd/MM/yyyy')}</span>
                                                <span className="text-sm text-muted-foreground truncate max-w-[200px]">- {note.reason}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="font-bold text-orange-600 dark:text-orange-400">-${note.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                                                <Button variant="outline" size="icon" className="h-8 w-8 text-destructive border-destructive/50 hover:bg-destructive/10" onClick={(e) => handleDeleteCreditNote(e, note.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Totals */}
                        <div className="flex justify-end">
                            <div className="w-full max-w-sm space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span>Subtotal:</span>
                                    <span className="font-medium">${displayInvoice.subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                                </div>
                                {displayInvoice.discount > 0 && (
                                    <div className="flex justify-between text-sm text-muted-foreground">
                                        <span>Descuento ({displayInvoice.discount}%):</span>
                                        <span>-${((displayInvoice.subtotal * displayInvoice.discount) / 100).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-sm">
                                    <span>ITBIS:</span>
                                    <span className="font-medium">${displayInvoice.tax.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <Separator />
                                <div className="flex justify-between text-lg font-bold">
                                    <span>Total Factura:</span>
                                    <span className="text-primary">${displayInvoice.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                                </div>

                                <div className="pt-2 space-y-1">
                                    <div className="flex justify-between text-sm text-muted-foreground">
                                        <span>Pagado / Acreditado:</span>
                                        <span className="font-medium text-green-600">-${(displayInvoice.paidAmount || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <Separator className="my-1" />
                                    <div className="flex justify-between text-base font-bold text-orange-600">
                                        <span>Pendiente:</span>
                                        <span>${Math.max(0, displayInvoice.total - (displayInvoice.paidAmount || 0)).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Notes */}
                        {displayInvoice.notes && (
                            <>
                                <Separator />
                                <div>
                                    <p className="text-sm text-muted-foreground mb-2">Notas</p>
                                    <p className="text-sm bg-muted/30 p-3 rounded-md">{displayInvoice.notes}</p>
                                </div>
                            </>
                        )}

                        {/* Footer Info */}
                        <div className="text-xs text-muted-foreground pt-4 border-t">
                            <p>Creada: {format(new Date(displayInvoice.createdAt), 'dd/MM/yyyy HH:mm', { locale: es })}</p>
                            <p>Última actualización: {format(new Date(displayInvoice.updatedAt), 'dd/MM/yyyy HH:mm', { locale: es })}</p>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <ViewCreditNoteDialog
                creditNote={selectedCreditNote}
                open={showCreditNoteDialog}
                onOpenChange={setShowCreditNoteDialog}
            />
            <ViewDebitNoteDialog
                debitNote={selectedDebitNote}
                open={showDebitNoteDialog}
                onOpenChange={setShowDebitNoteDialog}
            />
        </>
    );
}
