"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Search, FileText, Eye, Edit, Trash2, DollarSign, FileX, Download, Filter, CheckSquare, X, Send, Loader2 } from 'lucide-react';
import { getInvoices, deleteInvoiceAction, fixInvoiceBalances } from '@/lib/actions/invoiceActions';
import { getAllCreditNotes, deleteCreditNote, getAllDebitNotes, deleteDebitNote } from '@/lib/actions/paymentActions';
import { syncNCFSequences } from '@/lib/actions/settingsActions';
import { Invoice, InvoiceStatus, CreditNote } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CreateInvoiceDialog } from '@/components/invoices/create-invoice-dialog';
import { ViewInvoiceDialog } from '@/components/invoices/view-invoice-dialog';
import { ViewCreditNoteDialog } from '@/components/invoices/view-credit-note-dialog';
import { ViewDebitNoteDialog } from '@/components/invoices/view-debit-note-dialog';
import { EditInvoiceDialog } from '@/components/invoices/edit-invoice-dialog';
import { EditCreditNoteDialog } from '@/components/invoices/edit-credit-note-dialog';
import { RegisterPaymentDialog } from '@/components/invoices/register-payment-dialog';
import { CreateCreditNoteDialog } from '@/components/invoices/create-credit-note-dialog';
import { CreateDebitNoteDialog } from '@/components/invoices/create-debit-note-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { MonthPicker } from '@/components/ui/month-picker';
import { EcfActionButtons } from '@/components/invoices/ecf-action-buttons';
import { EmailIcon, WhatsAppIcon } from '@/components/share-icons';
import { shareInvoicePdf } from '@/lib/pdf/sharePdf';
import { sendBulkECF } from '@/lib/actions/ecfActions';

type FiscalDocument = 
    | (Invoice & { documentType: 'invoice' }) 
    | (CreditNote & { documentType: 'creditNote', number: string, dueDate: string | Date, status: string, paidAmount: number })
    | (any & { documentType: 'debitNote', number: string, dueDate: string | Date, status: string, paidAmount: number });

export default function InvoicesPage() {
    const { toast } = useToast();
    const currentDate = new Date();
    const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth().toString());
    const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear().toString());
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
    const [documents, setDocuments] = useState<FiscalDocument[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilters, setStatusFilters] = useState<string[]>([]);
    const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

    // ... (rest of states)

    const toggleStatusFilter = (status: string) => {
        setStatusFilters(prev =>
            prev.includes(status)
                ? prev.filter(s => s !== status)
                : [...prev, status]
        );
    };
    const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
    const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
    const [deleteInvoice, setDeleteInvoice] = useState<FiscalDocument | null>(null);
    const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
    const [creditNoteInvoice, setCreditNoteInvoice] = useState<Invoice | null>(null);
    const [viewCreditNote, setViewCreditNote] = useState<CreditNote | null>(null);
    const [editCreditNote, setEditCreditNote] = useState<CreditNote | null>(null);
    const [creditNoteToDelete, setCreditNoteToDelete] = useState<CreditNote | null>(null);
    const [debitNoteInvoice, setDebitNoteInvoice] = useState<Invoice | null>(null);
    const [viewDebitNote, setViewDebitNote] = useState<any | null>(null);
    const [debitNoteToDelete, setDebitNoteToDelete] = useState<any | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [isBulkSending, setIsBulkSending] = useState(false);

    const handleDeleteCreditNote = async () => {
        if (!creditNoteToDelete) return;
        const result = await deleteCreditNote(creditNoteToDelete.id);
        if (result.success) {
            toast({ title: "Éxito", description: "Nota de crédito eliminada correctamente" });
            fetchInvoices();
        } else {
            toast({ title: "Error", description: result.message, variant: "destructive" });
        }
        setCreditNoteToDelete(null);
    };

    const handleDeleteDebitNote = async () => {
        if (!debitNoteToDelete) return;
        const result = await deleteDebitNote(debitNoteToDelete.id);
        if (result.success) {
            toast({ title: "Éxito", description: "Nota de débito eliminada correctamente" });
            fetchInvoices();
        } else {
            toast({ title: "Error", description: result.message, variant: "destructive" });
        }
        setDebitNoteToDelete(null);
    };

    // ... (rest of the code)


    const itemsPerPage = 20;

    const months = [
        { value: "0", label: "Enero" },
        { value: "1", label: "Febrero" },
        { value: "2", label: "Marzo" },
        { value: "3", label: "Abril" },
        { value: "4", label: "Mayo" },
        { value: "5", label: "Junio" },
        { value: "6", label: "Julio" },
        { value: "7", label: "Agosto" },
        { value: "8", label: "Septiembre" },
        { value: "9", label: "Octubre" },
        { value: "10", label: "Noviembre" },
        { value: "11", label: "Diciembre" },
    ];

    useEffect(() => {
        fetchInvoices();
    }, [selectedMonth, selectedYear]);

    const fetchInvoices = async () => {
        setIsLoading(true);
        try {
            const offset = new Date().getTimezoneOffset();
            const [invoicesData, creditNotesData, debitNotesData] = await Promise.all([
                getInvoices(selectedMonth, selectedYear, offset),
                getAllCreditNotes(selectedMonth, selectedYear, offset),
                getAllDebitNotes(selectedMonth, selectedYear, offset)
            ]);

            setInvoices(invoicesData);
            setCreditNotes(creditNotesData);

            // Combine all fiscal documents
            const combined: FiscalDocument[] = [
                ...invoicesData.map(inv => ({ ...inv, documentType: 'invoice' as const })),
                ...creditNotesData.map(cn => ({
                    ...cn,
                    documentType: 'creditNote' as const,
                    number: cn.number || `NC-${cn.id}`,
                    status: 'Anulada' as InvoiceStatus,
                    dueDate: cn.date,
                    paidAmount: 0,
                    items: cn.items
                })),
                ...debitNotesData.map(dn => ({
                    ...dn,
                    documentType: 'debitNote' as const,
                    number: dn.number || `ND-${dn.id}`,
                    status: 'Aplicada',
                    dueDate: dn.date,
                    paidAmount: 0,
                    items: dn.items
                }))
            ];

            // Sort by creation date first so new credit/debit notes surface immediately.
            combined.sort((a, b) => {
                const createdAtA = new Date((a as { createdAt?: string | Date }).createdAt || a.date).getTime();
                const createdAtB = new Date((b as { createdAt?: string | Date }).createdAt || b.date).getTime();

                if (createdAtA !== createdAtB) {
                    return createdAtB - createdAtA;
                }

                return new Date(b.date).getTime() - new Date(a.date).getTime();
            });
            setDocuments(combined);
        } catch (error) {
            console.error("Failed to fetch documents", error);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredDocuments = documents.filter(doc => {
        const matchesSearch = doc.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
            doc.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ((doc as any).originalInvoiceNumber && (doc as any).originalInvoiceNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (doc.ncf && doc.ncf.toLowerCase().includes(searchTerm.toLowerCase()));

        // Calculate real status for filtering (handle Vencida dynamically for better UX)
        let docStatus = doc.status;
        if (docStatus === 'Pendiente' && new Date(doc.dueDate) < new Date() && doc.documentType === 'invoice') {
            docStatus = 'Vencida';
        }

        const matchesStatus = statusFilters.length === 0 || statusFilters.includes(docStatus) || (statusFilters.includes('Pendiente') && docStatus === 'Vencida');

        // Date Logic override:
        // By default, we only show docs from the selected Month/Year.
        // BUT, if the user explicitly filters for 'Pendiente', 'Parcial', or 'Vencida', we want to show those GLOBALLY (even past ones).

        const docDate = new Date(doc.date);
        const isInSelectedMonth = docDate.getMonth() === parseInt(selectedMonth) && docDate.getFullYear() === parseInt(selectedYear);

        // Check if current active filters imply looking for debt
        const isDebtFilterActive = statusFilters.some(s => ['Pendiente', 'Parcial', 'Vencida'].includes(s));

        // If a debt filter is active AND this doc matches that debt status, show it regardless of date.
        // Otherwise, enforce month selection.
        const matchesDate = isDebtFilterActive && ['Pendiente', 'Parcial', 'Vencida'].includes(docStatus)
            ? true // Show global debt if filtered
            : isInSelectedMonth; // Otherwise restrict to month

        return matchesSearch && matchesStatus && matchesDate;
    });

    const totalPages = Math.ceil(filteredDocuments.length / itemsPerPage);
    const paginatedDocuments = filteredDocuments.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedInvoices(paginatedDocuments.map(doc => doc.id));
        } else {
            setSelectedInvoices([]);
        }
    };

    const handleSelectInvoice = (id: string, checked: boolean) => {
        if (checked) {
            setSelectedInvoices(prev => [...prev, id]);
        } else {
            setSelectedInvoices(prev => prev.filter(item => item !== id));
        }
    };

    const isDgiiLocked = (doc: any) => Boolean(doc.ecfTrackId || doc.ecfSignedXml);

    const selectedDocuments = documents.filter(doc => selectedInvoices.includes(doc.id));
    const selectedBulkSendCandidates = selectedDocuments.filter(doc =>
        doc.documentType === 'invoice' &&
        doc.ncfType?.startsWith('E') &&
        !isDgiiLocked(doc)
    ) as Invoice[];

    const handleBulkSendECF = async () => {
        if (selectedBulkSendCandidates.length === 0) {
            toast({
                title: "Sin facturas elegibles",
                description: "Seleccione facturas electrónicas que aún no hayan sido enviadas a la DGII.",
                variant: "destructive",
            });
            return;
        }

        setIsBulkSending(true);
        const result = await sendBulkECF(selectedBulkSendCandidates.map(invoice => invoice.id));
        setIsBulkSending(false);

        toast({
            title: result.failed > 0 ? "Envío masivo completado con errores" : "Envío masivo completado",
            description: result.message,
            variant: result.failed > 0 && result.sent === 0 ? "destructive" : "default",
        });

        setSelectedInvoices([]);
        setIsSelectionMode(false);
        fetchInvoices();
    };

    const toggleSelectionMode = () => {
        if (isSelectionMode) {
            setIsSelectionMode(false);
            setSelectedInvoices([]);
        } else {
            setIsSelectionMode(true);
        }
    };

    const shareInvoice = async (invoice: Invoice, _channel: 'whatsapp' | 'email') => {
        try {
            const result = await shareInvoicePdf(invoice.id);
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

    const exportToExcel = () => {
        const docsToExport = selectedInvoices.length > 0
            ? documents.filter(doc => selectedInvoices.includes(doc.id))
            : filteredDocuments;

        const headers = ["Número", "E-CF/N-CF", "Tipo NCF", "Factura Origen", "Cliente", "RNC", "Fecha", "Vencimiento", "Estado", "Subtotal", "Impuestos", "Descuento", "Total", "Pagado"];

        const rows = docsToExport.map(doc => [
            doc.number,
            doc.ncf || '',
            doc.ncfType || '',
            (doc as any).originalInvoiceNumber || '',
            `"${doc.clientName}"`, // Quote to handle commas
            doc.clientRnc || '',
            format(new Date(doc.date), 'yyyy-MM-dd'),
            format(new Date(doc.dueDate), 'yyyy-MM-dd'),
            doc.status,
            doc.subtotal.toFixed(2),
            doc.tax.toFixed(2),
            doc.discount.toFixed(2),
            doc.total.toFixed(2),
            doc.paidAmount.toFixed(2)
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `facturas_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDelete = async () => {
        if (!deleteInvoice) return;

        let result;
        if (deleteInvoice.documentType === 'creditNote') {
            result = await deleteCreditNote(deleteInvoice.id);
        } else if (deleteInvoice.documentType === 'debitNote') {
            result = await deleteDebitNote(deleteInvoice.id);
        } else {
            result = await deleteInvoiceAction(deleteInvoice.id);
        }

        if (result.success) {
            toast({
                title: "Éxito",
                description: result.message || "Documento eliminado correctamente",
            });
            fetchInvoices();
        } else {
            toast({
                title: "Error",
                description: result.message || "No se pudo eliminar el documento",
                variant: "destructive",
            });
        }

        setDeleteInvoice(null);
    };

    const getStatusBadge = (status: InvoiceStatus) => {
        switch (status) {
            case 'Pagada': return <Badge className="bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400">Pagada</Badge>;
            case 'Parcial': return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400">Pago Parcial</Badge>;
            case 'Pendiente': return <Badge variant="secondary" className="bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400">Pendiente</Badge>;
            case 'Vencida': return <Badge variant="destructive">Vencida</Badge>;
            case 'Anulada': return <Badge variant="outline">Anulada</Badge>;
            case 'Nota de Crédito Parcial': return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-400">NC Parcial</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[50vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-4 md:space-y-8">
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center md:gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Facturas</h1>
                    <p className="mt-1 text-sm text-muted-foreground md:text-base">Gestione sus facturas y cuentas por cobrar.</p>
                </div>
                <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
                    <MonthPicker
                        currentMonth={selectedMonth}
                        currentYear={selectedYear}
                        onMonthChange={setSelectedMonth}
                        onYearChange={setSelectedYear}
                    />

                    <Button
                        variant={isSelectionMode ? "secondary" : "outline"}
                        onClick={toggleSelectionMode}
                        className="w-full gap-2 sm:w-auto"
                    >
                        {isSelectionMode ? <X className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
                        {isSelectionMode ? "Cancelar" : "Seleccionar"}
                    </Button>

                    <Button
                        variant="outline"
                        onClick={exportToExcel}
                        className="w-full gap-2 sm:w-auto"
                        disabled={isSelectionMode && selectedInvoices.length === 0}
                    >
                        <Download className="h-4 w-4" />
                        Exportar {selectedInvoices.length > 0 ? `(${selectedInvoices.length})` : ''}
                    </Button>

                    {isSelectionMode && (
                        <Button
                            variant="outline"
                            onClick={handleBulkSendECF}
                            className="w-full gap-2 border-blue-500 text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950 sm:w-auto"
                            disabled={isBulkSending || selectedBulkSendCandidates.length === 0}
                        >
                            {isBulkSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            Enviar DGII {selectedBulkSendCandidates.length > 0 ? `(${selectedBulkSendCandidates.length})` : ''}
                        </Button>
                    )}

                    <Button
                        className="w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto"
                        onClick={() => setIsCreateDialogOpen(true)}
                    >
                        <PlusCircle className="mr-2 h-5 w-5" /> Nueva Factura
                    </Button>
                </div>
            </div>

            <Card className="border shadow-sm bg-card md:border-none md:bg-card/50 md:shadow-md md:backdrop-blur-sm">
                <CardHeader className="p-4 pb-3 md:p-6 md:pb-4">
                    <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:justify-between md:gap-4">
                        <div className="relative w-full sm:max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por número o cliente..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="w-full border-dashed sm:w-auto">
                                        <Filter className="mr-2 h-4 w-4" />
                                        Estado
                                        {statusFilters.length > 0 && (
                                            <>
                                                <div className="hidden space-x-1 lg:flex ml-2">
                                                    {statusFilters.length > 2 ? (
                                                        <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                                                            {statusFilters.length} seleccionados
                                                        </Badge>
                                                    ) : (
                                                        statusFilters.map(option => (
                                                            <Badge variant="secondary" key={option} className="rounded-sm px-1 font-normal">
                                                                {option}
                                                            </Badge>
                                                        ))
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-[200px]">
                                    <DropdownMenuLabel>Filtrar por estado</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {['Pendiente', 'Pagada', 'Parcial', 'Vencida', 'Anulada'].map((status) => (
                                        <DropdownMenuItem key={status} onSelect={(e) => e.preventDefault()}>
                                            <div className="flex items-center space-x-2" onClick={() => toggleStatusFilter(status)}>
                                                <div className={`h-4 w-4 rounded border border-primary flex items-center justify-center ${statusFilters.includes(status) ? 'bg-primary text-primary-foreground' : 'opacity-50'}`}>
                                                    {statusFilters.includes(status) && <CheckSquare className="h-3 w-3" />}
                                                </div>
                                                <span>{status}</span>
                                            </div>
                                        </DropdownMenuItem>
                                    ))}
                                    {statusFilters.length > 0 && (
                                        <>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onSelect={() => setStatusFilters([])} className="justify-center text-center">
                                                Limpiar filtros
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
                    <div className="rounded-md border overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    {isSelectionMode && (
                                        <TableHead className="w-[40px]">
                                            <input
                                                type="checkbox"
                                                className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                                                checked={paginatedDocuments.length > 0 && selectedInvoices.length === paginatedDocuments.length}
                                                onChange={(e) => handleSelectAll(e.target.checked)}
                                            />
                                        </TableHead>
                                    )}
                                    <TableHead>Número</TableHead>
                                    <TableHead>E-CF/N-CF</TableHead>
                                    <TableHead>Factura Origen</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Fecha Emisión</TableHead>
                                    <TableHead>Vencimiento</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                    <TableHead className="text-right">Estado</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedDocuments.length > 0 ? (
                                    paginatedDocuments.map((doc) => {
                                        const isInvoice = doc.documentType === 'invoice';
                                        const isCreditNote = doc.documentType === 'creditNote';
                                        const isDebitNote = doc.documentType === 'debitNote';
                                        const invoice = isInvoice ? (doc as Invoice) : null;
                                        const isSelected = selectedInvoices.includes(doc.id);
                                        const lockedByDgii = isDgiiLocked(doc);

                                        return (
                                            <TableRow key={`${doc.documentType}-${doc.id}`} className="hover:bg-muted/30">
                                                {isSelectionMode && (
                                                    <TableCell>
                                                        <input
                                                            type="checkbox"
                                                            className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                                                            checked={isSelected}
                                                            onChange={(e) => handleSelectInvoice(doc.id, e.target.checked)}
                                                        />
                                                    </TableCell>
                                                )}
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-2">
                                                        {doc.number}
                                                        {isCreditNote && (
                                                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 text-xs">
                                                                Nota Crédito
                                                            </Badge>
                                                        )}
                                                        {doc.documentType === 'debitNote' && (
                                                            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 text-xs">
                                                                Nota Débito
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-mono text-xs">
                                                        {doc.ncf || 'N/A'}
                                                    </div>
                                                    {doc.ncfType && (
                                                        <div className="text-xs text-muted-foreground">
                                                            {doc.ncfType}
                                                        </div>
                                                    )}
                                                    {/* e-CF Actions for all Electronic Documents (E31, E33, E34) */}
                                                    {doc.ncfType?.startsWith('E') && (
                                                        <EcfActionButtons
                                                            invoiceId={doc.id}
                                                            ncfType={doc.ncfType}
                                                            ecfStatus={(doc as any).ecfStatus}
                                                            ecfTrackId={(doc as any).ecfTrackId}
                                                            encf={(doc as any).encf}
                                                            documentType={doc.documentType === 'creditNote' ? 'CreditNote' : doc.documentType === 'debitNote' ? 'DebitNote' : 'Invoice'}
                                                            onStatusChange={fetchInvoices}
                                                        />
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {isCreditNote || isDebitNote ? (
                                                        <div>
                                                            <div className="font-medium">{(doc as any).originalInvoiceNumber || 'N/A'}</div>
                                                            {(doc as any).originalInvoiceNcf && (
                                                                <div className="font-mono text-xs text-muted-foreground">
                                                                    {(doc as any).originalInvoiceNcf}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground text-sm">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>{doc.clientName}</TableCell>
                                                <TableCell className="text-muted-foreground text-sm">
                                                    {format(new Date(doc.date), 'dd MMM yyyy', { locale: es })}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-sm">
                                                    {format(new Date(doc.dueDate), 'dd MMM yyyy', { locale: es })}
                                                </TableCell>
                                                <TableCell className={`text-right font-bold ${isCreditNote ? 'text-red-600 dark:text-red-400' : ''}`}>
                                                    {isCreditNote && '-'}${doc.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {isCreditNote || isDebitNote ? (
                                                        <Badge variant="outline" className="bg-gray-100 dark:bg-gray-800">
                                                            Aplicada
                                                        </Badge>
                                                    ) : (
                                                        getStatusBadge(doc.status)
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {isInvoice && invoice ? (
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="sm">
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem onClick={() => setViewInvoice(invoice)}>
                                                                    <Eye className="h-4 w-4 mr-2" />
                                                                    Ver Detalles
                                                                </DropdownMenuItem>
                                                                {!lockedByDgii && (
                                                                    <DropdownMenuItem onClick={() => setEditInvoice(invoice)}>
                                                                        <Edit className="h-4 w-4 mr-2" />
                                                                        Editar
                                                                    </DropdownMenuItem>
                                                                )}
                                                                <DropdownMenuItem onClick={() => shareInvoice(invoice, 'whatsapp')}>
                                                                    <WhatsAppIcon className="h-4 w-4 mr-2 text-green-600" />
                                                                    Enviar PDF por WhatsApp
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => shareInvoice(invoice, 'email')}>
                                                                    <EmailIcon className="h-4 w-4 mr-2 text-blue-600" />
                                                                    Enviar PDF por Correo
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem
                                                                    onClick={() => setPaymentInvoice(invoice)}
                                                                    disabled={invoice.status === 'Pagada' || invoice.status === 'Anulada'}
                                                                >
                                                                    <DollarSign className="h-4 w-4 mr-2" />
                                                                    Registrar Pago
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    onClick={() => setCreditNoteInvoice(invoice)}
                                                                    disabled={invoice.status === 'Anulada'}
                                                                >
                                                                    <FileX className="h-4 w-4 mr-2" />
                                                                    Crear Nota de Crédito
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    onClick={() => setDebitNoteInvoice(invoice)}
                                                                    disabled={invoice.status === 'Anulada'}
                                                                >
                                                                    <PlusCircle className="h-4 w-4 mr-2" />
                                                                    Crear Nota de Débito
                                                                </DropdownMenuItem>
                                                                {!lockedByDgii && (
                                                                    <>
                                                                        <DropdownMenuSeparator />
                                                                        <DropdownMenuItem
                                                                            onClick={() => setDeleteInvoice(doc)}
                                                                            className="text-destructive focus:text-destructive"
                                                                        >
                                                                            <Trash2 className="h-4 w-4 mr-2" />
                                                                            Eliminar
                                                                        </DropdownMenuItem>
                                                                    </>
                                                                )}
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    ) : isCreditNote ? (
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="sm">
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuLabel>Acciones NC</DropdownMenuLabel>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem onClick={() => setViewCreditNote(doc as CreditNote)}>
                                                                    <Eye className="h-4 w-4 mr-2" />
                                                                    Ver Detalles
                                                                </DropdownMenuItem>
                                                                {!lockedByDgii && (
                                                                    <>
                                                                        <DropdownMenuItem onClick={() => setEditCreditNote(doc as CreditNote)}>
                                                                            <Edit className="h-4 w-4 mr-2" />
                                                                            Editar
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuSeparator />
                                                                        <DropdownMenuItem
                                                                            onClick={() => setCreditNoteToDelete(doc as CreditNote)}
                                                                            className="text-destructive focus:text-destructive"
                                                                        >
                                                                            <Trash2 className="h-4 w-4 mr-2" />
                                                                            Eliminar
                                                                        </DropdownMenuItem>
                                                                    </>
                                                                )}
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    ) : isDebitNote ? (
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="sm">
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuLabel>Acciones ND</DropdownMenuLabel>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem onClick={() => setViewDebitNote(doc)}>
                                                                    <Eye className="h-4 w-4 mr-2" />
                                                                    Ver Detalles
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => window.open(`/invoices/${doc.id}/print`, '_blank')}>
                                                                    <FileText className="h-4 w-4 mr-2" />
                                                                    Imprimir
                                                                </DropdownMenuItem>
                                                                {!lockedByDgii && (
                                                                    <>
                                                                        <DropdownMenuSeparator />
                                                                        <DropdownMenuItem
                                                                            onClick={() => setDeleteInvoice(doc)}
                                                                            className="text-destructive focus:text-destructive"
                                                                        >
                                                                            <Trash2 className="h-4 w-4 mr-2" />
                                                                            Eliminar
                                                                        </DropdownMenuItem>
                                                                    </>
                                                                )}
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    ) : (
                                                        <span className="text-muted-foreground text-sm">-</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={isSelectionMode ? 10 : 9} className="h-32 text-center">
                                            <div className="flex flex-col items-center justify-center text-muted-foreground">
                                                <FileText className="h-10 w-10 mb-2 opacity-20" />
                                                <p>No se encontraron facturas.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:space-x-2">
                        <div className="text-sm text-muted-foreground">
                            Mostrando {paginatedDocuments.length} de {filteredDocuments.length} resultados
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:space-x-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                            >
                                Anterior
                            </Button>
                            <div className="col-span-2 text-center text-sm font-medium sm:col-span-1">
                                Página {currentPage} de {totalPages || 1}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages || totalPages === 0}
                            >
                                Siguiente
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <CreateInvoiceDialog
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
                onSuccess={fetchInvoices}
            />

            <ViewInvoiceDialog
                invoice={viewInvoice}
                open={!!viewInvoice}
                onOpenChange={(open) => !open && setViewInvoice(null)}
            />

            <EditInvoiceDialog
                invoice={editInvoice}
                open={!!editInvoice}
                onOpenChange={(open) => !open && setEditInvoice(null)}
                onSuccess={fetchInvoices}
            />

            <AlertDialog open={!!deleteInvoice} onOpenChange={(open) => !open && setDeleteInvoice(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar Factura?</AlertDialogTitle>
                        <AlertDialogDescription>
                            ¿Está seguro que desea eliminar la factura <strong>{deleteInvoice?.number}</strong>?
                            Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <RegisterPaymentDialog
                invoice={paymentInvoice}
                open={!!paymentInvoice}
                onOpenChange={(open) => !open && setPaymentInvoice(null)}
                onSuccess={fetchInvoices}
            />

            <CreateCreditNoteDialog
                invoice={creditNoteInvoice}
                open={!!creditNoteInvoice}
                onOpenChange={(open) => !open && setCreditNoteInvoice(null)}
                onSuccess={fetchInvoices}
            />

            <CreateDebitNoteDialog
                invoice={debitNoteInvoice}
                open={!!debitNoteInvoice}
                onOpenChange={(open) => !open && setDebitNoteInvoice(null)}
                onSuccess={fetchInvoices}
            />

            <ViewCreditNoteDialog
                creditNote={viewCreditNote}
                open={!!viewCreditNote}
                onOpenChange={(open) => !open && setViewCreditNote(null)}
            />

            <ViewDebitNoteDialog
                debitNote={viewDebitNote}
                open={!!viewDebitNote}
                onOpenChange={(open) => !open && setViewDebitNote(null)}
            />

            <EditCreditNoteDialog
                creditNote={editCreditNote}
                open={!!editCreditNote}
                onOpenChange={(open) => !open && setEditCreditNote(null)}
                onSuccess={fetchInvoices}
            />

            <AlertDialog open={!!creditNoteToDelete} onOpenChange={(open) => !open && setCreditNoteToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar Nota de Crédito?</AlertDialogTitle>
                        <AlertDialogDescription>
                            ¿Está seguro que desea eliminar la nota de crédito <strong>{creditNoteToDelete?.ncf}</strong>?
                            Esta acción revertirá el saldo a la factura original.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteCreditNote} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    );
}
