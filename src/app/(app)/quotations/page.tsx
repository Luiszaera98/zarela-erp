"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ClipboardList, Eye, FileText, MoreHorizontal, PlusCircle, Printer, Search, Send, Trash2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { EmailIcon, WhatsAppIcon } from '@/components/share-icons';
import { useToast } from '@/hooks/use-toast';
import { getClients } from '@/lib/actions/clientActions';
import { getProducts } from '@/lib/actions/inventoryActions';
import { getServices } from '@/lib/actions/serviceActions';
import { createInvoiceFromQuotation, createQuotation, deleteQuotationAction, getQuotations, updateQuotationStatus } from '@/lib/actions/quotationActions';
import { shareQuotationPdf } from '@/lib/pdf/sharePdf';
import { Client, NCF_TYPES, NCFType, Product, Quotation, QuotationStatus, Service } from '@/types';

interface QuotationItemForm {
    productId: string;
    productName: string;
    description?: string;
    itemType: 'product' | 'service';
    quantity: number | string;
    price: number | string;
    discount: number | string;
}

export default function QuotationsPage() {
    const { toast } = useToast();
    const [quotations, setQuotations] = useState<Quotation[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [viewQuotation, setViewQuotation] = useState<Quotation | null>(null);
    const [deleteQuotation, setDeleteQuotation] = useState<Quotation | null>(null);
    const [convertQuotation, setConvertQuotation] = useState<Quotation | null>(null);
    const [isConverting, setIsConverting] = useState(false);

    const [clientId, setClientId] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [validUntil, setValidUntil] = useState(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    const [items, setItems] = useState<QuotationItemForm[]>([
        { productId: '', productName: '', description: '', itemType: 'product', quantity: 1, price: 0, discount: 0 }
    ]);
    const [generalDiscount, setGeneralDiscount] = useState<number | string>(0);
    const [taxRate, setTaxRate] = useState<number | string>(18);
    const [notes, setNotes] = useState('');
    const [invoiceNcfType, setInvoiceNcfType] = useState<NCFType>('B01');
    const [invoiceDueDate, setInvoiceDueDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        const [quotationsData, clientsResult, productsResult, servicesResult] = await Promise.all([
            getQuotations(),
            getClients(1, 1000),
            getProducts(1, 1000),
            getServices(1, 1000, '', 'Activo')
        ]);

        setQuotations(quotationsData);
        setClients(clientsResult.clients || []);
        setProducts(productsResult.products || []);
        setServices(servicesResult.services || []);
        setIsLoading(false);
    };

    const filteredQuotations = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return quotations.filter(quotation =>
            quotation.number.toLowerCase().includes(term) ||
            quotation.clientName.toLowerCase().includes(term) ||
            quotation.status.toLowerCase().includes(term)
        );
    }, [quotations, searchTerm]);

    const parseNum = (value: number | string): number => {
        if (typeof value === 'number') return value;
        const parsed = parseFloat(value);
        return isNaN(parsed) ? 0 : parsed;
    };

    const selectedClient = clients.find(client => client.id === clientId);

    const updateItem = (index: number, field: keyof QuotationItemForm, value: string | number) => {
        const nextItems = [...items];
        nextItems[index] = { ...nextItems[index], [field]: value };

        if (field === 'productId') {
            const product = products.find(item => item.id === value);
            if (product) {
                nextItems[index].productName = product.name;
                nextItems[index].price = product.price;
                nextItems[index].description = product.description || '';
            }
        }

        setItems(nextItems);
    };

    const selectCatalogService = (index: number, value: string) => {
        if (value === 'manual') {
            updateItem(index, 'productId', `SERVICE-${Date.now()}`);
            return;
        }

        const service = services.find(item => item.id === value);
        if (!service) return;

        const nextItems = [...items];
        nextItems[index] = {
            ...nextItems[index],
            productId: `SERVICE-CATALOG-${service.id}`,
            productName: service.name,
            description: service.description || '',
            itemType: 'service',
            price: service.price,
        };
        setItems(nextItems);
    };

    const addItem = () => {
        setItems([...items, { productId: '', productName: '', description: '', itemType: 'product', quantity: 1, price: 0, discount: 0 }]);
    };

    const isBlankProductItem = (item: QuotationItemForm) =>
        item.itemType === 'product' &&
        !item.productId &&
        !item.productName.trim() &&
        Number(item.price || 0) === 0;

    const createServiceItem = (): QuotationItemForm => ({
        productId: `SERVICE-${Date.now()}`,
        productName: '',
        description: '',
        itemType: 'service',
        quantity: 1,
        price: 0,
        discount: 0,
    });

    const addService = () => {
        const serviceItem = createServiceItem();
        if (items.length === 1 && isBlankProductItem(items[0])) {
            setItems([serviceItem]);
            return;
        }

        setItems([...items, serviceItem]);
    };

    const removeItem = (index: number) => {
        if (items.length > 1) {
            setItems(items.filter((_, itemIndex) => itemIndex !== index));
        }
    };

    const calculateItemTotal = (item: QuotationItemForm) => {
        const subtotal = parseNum(item.quantity) * parseNum(item.price);
        return subtotal - ((subtotal * parseNum(item.discount)) / 100);
    };

    const itemsTotal = items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
    const discountAmount = (itemsTotal * parseNum(generalDiscount)) / 100;
    const subtotal = itemsTotal - discountAmount;
    const tax = (subtotal * parseNum(taxRate)) / 100;
    const total = subtotal + tax;

    const resetForm = () => {
        setClientId('');
        setDate(new Date().toISOString().split('T')[0]);
        setValidUntil(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
        setItems([{ productId: '', productName: '', description: '', itemType: 'product', quantity: 1, price: 0, discount: 0 }]);
        setGeneralDiscount(0);
        setTaxRate(18);
        setNotes('');
    };

    const handleCreateQuotation = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!selectedClient) {
            toast({ title: "Error", description: "Seleccione un cliente válido", variant: "destructive" });
            return;
        }

        if (items.some(item => !item.productId || !item.productName.trim() || parseNum(item.quantity) <= 0)) {
            toast({ title: "Error", description: "Complete los productos y cantidades", variant: "destructive" });
            return;
        }

        setIsSaving(true);
        const result = await createQuotation({
            clientId,
            clientName: selectedClient.name,
            clientRnc: selectedClient.rncCedula,
            clientAddress: selectedClient.address,
            date: new Date(date + 'T12:00:00Z').toISOString(),
            validUntil: new Date(validUntil + 'T12:00:00Z').toISOString(),
            items: items.map(item => ({
                productId: item.productId,
                productName: item.productName,
                description: item.description,
                itemType: item.itemType,
                quantity: parseNum(item.quantity),
                price: parseNum(item.price),
                discount: parseNum(item.discount),
            })),
            discount: parseNum(generalDiscount),
            tax,
            notes,
        });

        setIsSaving(false);

        if (result.success) {
            toast({ title: "Éxito", description: `Cotización ${result.quotation?.number} creada correctamente` });
            resetForm();
            setIsCreateDialogOpen(false);
            loadData();
        } else {
            toast({ title: "Error", description: result.message || "No se pudo crear la cotización", variant: "destructive" });
        }
    };

    const handleStatusChange = async (quotation: Quotation, status: QuotationStatus, successMessage?: string) => {
        const result = await updateQuotationStatus(quotation.id, status);
        if (result.success) {
            setQuotations(prev => prev.map(item => item.id === quotation.id ? { ...item, status } : item));
            setViewQuotation(prev => prev?.id === quotation.id ? { ...prev, status } : prev);
            if (successMessage) {
                toast({ title: "Estado actualizado", description: successMessage });
            }
        } else {
            toast({ title: "Error", description: result.message || "No se pudo actualizar el estado", variant: "destructive" });
        }
    };

    const handleShareQuotation = async (quotation: Quotation, _channel: 'whatsapp' | 'email') => {
        try {
            const result = await shareQuotationPdf(quotation.id);
            await handleStatusChange(quotation, 'Enviada', `La cotización ${quotation.number} fue marcada como enviada`);
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

    const handleDelete = async () => {
        if (!deleteQuotation) return;
        const result = await deleteQuotationAction(deleteQuotation.id);
        if (result.success) {
            toast({ title: "Éxito", description: result.message });
            setDeleteQuotation(null);
            loadData();
        } else {
            toast({ title: "Error", description: result.message || "No se pudo eliminar la cotización", variant: "destructive" });
        }
    };

    const handleConvertToInvoice = async () => {
        if (!convertQuotation) return;

        const diffMs = new Date(invoiceDueDate).getTime() - new Date().setHours(0, 0, 0, 0);
        const diffDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        const paymentTerms = diffDays <= 0 ? 'Contado' : `${diffDays} Días`;

        setIsConverting(true);
        const result = await createInvoiceFromQuotation(convertQuotation.id, {
            ncfType: invoiceNcfType,
            dueDate: new Date(invoiceDueDate + 'T12:00:00Z').toISOString(),
            paymentTerms,
        });
        setIsConverting(false);

        if (result.success) {
            toast({
                title: "Factura creada",
                description: `Se creó la factura ${result.invoiceNumber} desde la cotización ${convertQuotation.number}`,
            });
            setConvertQuotation(null);
            setViewQuotation(null);
            loadData();
        } else {
            toast({
                title: "Error",
                description: result.message || "No se pudo crear la factura desde la cotización",
                variant: "destructive",
            });
        }
    };

    const getStatusBadge = (status: QuotationStatus) => {
        const variants: Record<QuotationStatus, string> = {
            Pendiente: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
            Enviada: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
            Rechazada: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
            Facturada: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
        };

        return <Badge className={variants[status]}>{status}</Badge>;
    };

    const renderQuotationActions = (quotation: Quotation) => {
        const canSend = quotation.status === 'Pendiente';
        const canReject = quotation.status === 'Enviada';
        const canConvert = quotation.status === 'Enviada';
        const canDelete = quotation.status === 'Pendiente' || quotation.status === 'Rechazada';

        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setViewQuotation(quotation)}>
                        <Eye className="h-4 w-4 mr-2" />
                        Ver Detalles
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => window.open(`/quotations/${quotation.id}/print`, '_blank')}>
                        <Printer className="h-4 w-4 mr-2" />
                        Imprimir PDF
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleShareQuotation(quotation, 'whatsapp')}>
                        <WhatsAppIcon className="h-4 w-4 mr-2 text-green-600" />
                        Enviar PDF por WhatsApp
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleShareQuotation(quotation, 'email')}>
                        <EmailIcon className="h-4 w-4 mr-2 text-blue-600" />
                        Enviar PDF por Correo
                    </DropdownMenuItem>
                    {canSend && (
                        <DropdownMenuItem onClick={() => handleStatusChange(quotation, 'Enviada', `La cotización ${quotation.number} fue marcada como enviada`)}>
                            <Send className="h-4 w-4 mr-2" />
                            Marcar como Enviada
                        </DropdownMenuItem>
                    )}
                    {(canReject || canConvert) && <DropdownMenuSeparator />}
                    {canReject && (
                        <DropdownMenuItem onClick={() => handleStatusChange(quotation, 'Rechazada', `La cotización ${quotation.number} fue rechazada`)}>
                            <XCircle className="h-4 w-4 mr-2 text-red-600" />
                            Rechazar
                        </DropdownMenuItem>
                    )}
                    {canConvert && (
                        <DropdownMenuItem onClick={() => setConvertQuotation(quotation)}>
                            <FileText className="h-4 w-4 mr-2" />
                            Crear Factura
                        </DropdownMenuItem>
                    )}
                    {canDelete && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={() => setDeleteQuotation(quotation)}
                                className="text-destructive focus:text-destructive"
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Eliminar
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        );
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
                    <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Cotizaciones</h1>
                    <p className="mt-1 text-sm text-muted-foreground md:text-base">Prepare propuestas comerciales antes de facturar.</p>
                </div>
                <Button className="w-full gap-2 sm:w-auto" onClick={() => setIsCreateDialogOpen(true)}>
                    <PlusCircle className="h-5 w-5" />
                    Nueva Cotización
                </Button>
            </div>

            <Card className="border shadow-sm bg-card md:border-none md:bg-card/50 md:shadow-md md:backdrop-blur-sm">
                <CardHeader className="p-4 pb-3 md:p-6 md:pb-4">
                    <div className="relative w-full sm:max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por número, cliente o estado..."
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            className="pl-10"
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
                    <div className="rounded-md border overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead>Número</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Válida Hasta</TableHead>
                                    <TableHead>Total</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredQuotations.length > 0 ? (
                                    filteredQuotations.map((quotation) => (
                                        <TableRow key={quotation.id} className="hover:bg-muted/30">
                                            <TableCell className="font-medium">{quotation.number}</TableCell>
                                            <TableCell>{quotation.clientName}</TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {format(new Date(quotation.date), 'dd MMM yyyy', { locale: es })}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {format(new Date(quotation.validUntil), 'dd MMM yyyy', { locale: es })}
                                            </TableCell>
                                            <TableCell className="font-bold">
                                                ${quotation.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell>
                                                {getStatusBadge(quotation.status)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {renderQuotationActions(quotation)}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-32 text-center">
                                            <div className="flex flex-col items-center justify-center text-muted-foreground">
                                                <ClipboardList className="h-10 w-10 mb-2 opacity-20" />
                                                <p>No se encontraron cotizaciones.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="py-4 text-sm text-muted-foreground">
                        Mostrando {filteredQuotations.length} de {quotations.length} resultados
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-5xl">
                    <DialogHeader>
                        <DialogTitle>Nueva Cotización</DialogTitle>
                        <DialogDescription>Complete la propuesta comercial sin afectar inventario ni cuentas por cobrar.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateQuotation} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2 md:col-span-2">
                                <Label>Cliente *</Label>
                                <Select value={clientId} onValueChange={setClientId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccione cliente" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {clients.filter(client => client.contactType === 'Cliente' || (client.contactType as any) === 'Empresa').map(client => (
                                            <SelectItem key={client.id} value={client.id}>
                                                {client.name} {client.rncCedula && `(${client.rncCedula})`}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="quotation-date">Fecha *</Label>
                                <Input id="quotation-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="valid-until">Válida Hasta *</Label>
                                <Input id="valid-until" type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} required />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <Label>Productos/Servicios</Label>
                                <div className="grid grid-cols-2 gap-2 sm:flex">
                                    <Button type="button" onClick={addItem} size="sm" variant="outline" className="w-full sm:w-auto">
                                        <PlusCircle className="h-4 w-4 mr-2" />
                                        Producto
                                    </Button>
                                    <Button type="button" onClick={addService} size="sm" variant="outline" className="w-full sm:w-auto">
                                        <PlusCircle className="h-4 w-4 mr-2" />
                                        Servicio
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {items.map((item, index) => (
                                    <div key={index} className="grid grid-cols-12 gap-3 items-end rounded-md border bg-muted/20 p-3">
                                        <div className="col-span-12 md:col-span-5 space-y-2">
                                            {item.itemType === 'service' ? (
                                                <>
                                                    <Label className="text-xs">Servicio</Label>
                                                    <Select
                                                        value={item.productId.startsWith('SERVICE-CATALOG-') ? item.productId.replace('SERVICE-CATALOG-', '') : 'manual'}
                                                        onValueChange={(value) => selectCatalogService(index, value)}
                                                    >
                                                        <SelectTrigger className="mt-1">
                                                            <SelectValue placeholder="Seleccione servicio" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="manual">Manual</SelectItem>
                                                            {services.map(service => (
                                                                <SelectItem key={service.id} value={service.id}>
                                                                    {service.category ? `${service.category} - ` : ''}{service.name} - ${service.price.toLocaleString('es-DO')}
                                                                </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    {!item.productId.startsWith('SERVICE-CATALOG-') && (
                                                        <Input
                                                            value={item.productName}
                                                            onChange={(event) => updateItem(index, 'productName', event.target.value)}
                                                            placeholder="Nombre del servicio"
                                                        />
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    <Label className="text-xs">Producto</Label>
                                                    <Select value={item.productId} onValueChange={(value) => updateItem(index, 'productId', value)}>
                                                        <SelectTrigger className="mt-1">
                                                            <SelectValue placeholder="Seleccione" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {products.map(product => (
                                                                <SelectItem key={product.id} value={product.id}>
                                                                    {product.name} - ${product.price.toLocaleString('es-DO')}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </>
                                            )}
                                        </div>
                                        <div className="col-span-6 md:col-span-2">
                                            <Label className="text-xs">Cantidad</Label>
                                            <Input type="number" min="0" step="any" value={item.quantity} onChange={(event) => updateItem(index, 'quantity', event.target.value)} className="mt-1" />
                                        </div>
                                        <div className="col-span-6 md:col-span-2">
                                            <Label className="text-xs">Precio Unit.</Label>
                                            <Input type="number" min="0" step="0.01" value={item.price} onChange={(event) => updateItem(index, 'price', event.target.value)} className="mt-1" />
                                        </div>
                                        <div className="col-span-5 md:col-span-1">
                                            <Label className="text-xs">Desc. %</Label>
                                            <Input type="number" min="0" max="100" value={item.discount} onChange={(event) => updateItem(index, 'discount', event.target.value)} className="mt-1" />
                                        </div>
                                        <div className="col-span-5 md:col-span-1">
                                            <Label className="text-xs">Total</Label>
                                            <div className="mt-1 h-10 flex items-center font-semibold">
                                                ${calculateItemTotal(item).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                                            </div>
                                        </div>
                                        <div className="col-span-2 md:col-span-1">
                                            <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(index)} disabled={items.length === 1} className="w-full">
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="border-t pt-4 flex justify-end">
                            <div className="w-full max-w-sm space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span>Subtotal Ítems:</span>
                                    <span className="font-medium">${itemsTotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm gap-2">
                                    <span>Descuento General:</span>
                                    <div className="flex items-center gap-2">
                                        <Input type="number" min="0" max="100" value={generalDiscount} onChange={(event) => setGeneralDiscount(event.target.value)} className="w-16 h-8 text-sm" />
                                        <span className="text-xs">%</span>
                                        <span className="font-medium w-24 text-right">-${discountAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                                <div className="flex justify-between text-sm font-medium border-t pt-2">
                                    <span>Subtotal:</span>
                                    <span>${subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm gap-2">
                                    <span>ITBIS:</span>
                                    <div className="flex items-center gap-2">
                                        <Input type="number" min="0" max="100" value={taxRate} onChange={(event) => setTaxRate(event.target.value)} className="w-16 h-8 text-sm" />
                                        <span className="text-xs">%</span>
                                        <span className="font-medium w-24 text-right">${tax.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                                <div className="flex justify-between text-xl font-bold border-t pt-3">
                                    <span>Total:</span>
                                    <span className="text-primary">${total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="quotation-notes">Notas / Condiciones</Label>
                            <Textarea id="quotation-notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Términos, condiciones o vigencia comercial" />
                        </div>

                        <DialogFooter className="gap-2">
                            <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)} disabled={isSaving} className="w-full sm:w-auto">Cancelar</Button>
                            <Button type="submit" disabled={isSaving} className="w-full sm:w-auto">{isSaving ? "Creando..." : "Crear Cotización"}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={!!viewQuotation} onOpenChange={(open) => !open && setViewQuotation(null)}>
                <DialogContent className="sm:max-w-3xl">
                    <DialogHeader className="flex flex-row items-center justify-between gap-4">
                        <div>
                            <DialogTitle>{viewQuotation?.number}</DialogTitle>
                            <DialogDescription>{viewQuotation?.clientName}</DialogDescription>
                        </div>
                        {viewQuotation && (
                            <div className="flex items-center gap-2 flex-wrap justify-end">
                                {getStatusBadge(viewQuotation.status)}
                                <Button variant="outline" size="sm" onClick={() => window.open(`/quotations/${viewQuotation.id}/print`, '_blank')}>
                                    <Printer className="h-4 w-4 mr-2" />
                                    Imprimir
                                </Button>
                            </div>
                        )}
                    </DialogHeader>
                    {viewQuotation && (
                        <div className="space-y-4">
                            <div className="grid gap-4 text-sm sm:grid-cols-2">
                                <div>
                                    <span className="text-muted-foreground">Fecha:</span>
                                    <p className="font-medium">{format(new Date(viewQuotation.date), 'dd MMM yyyy', { locale: es })}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Válida Hasta:</span>
                                    <p className="font-medium">{format(new Date(viewQuotation.validUntil), 'dd MMM yyyy', { locale: es })}</p>
                                </div>
                            </div>
                            <div className="rounded-md border overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Producto</TableHead>
                                            <TableHead>Cant.</TableHead>
                                            <TableHead>Precio</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {viewQuotation.items.map(item => (
                                            <TableRow key={item.id}>
                                                <TableCell>{item.productName}</TableCell>
                                                <TableCell>{item.quantity}</TableCell>
                                                <TableCell>${item.price.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</TableCell>
                                                <TableCell className="text-right font-medium">${item.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            {viewQuotation.notes && (
                                <div className="text-sm">
                                    <span className="text-muted-foreground">Notas:</span>
                                    <p className="mt-1 whitespace-pre-wrap">{viewQuotation.notes}</p>
                                </div>
                            )}
                            <div className="flex justify-end text-xl font-bold">
                                Total: ${viewQuotation.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!deleteQuotation} onOpenChange={(open) => !open && setDeleteQuotation(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar Cotización?</AlertDialogTitle>
                        <AlertDialogDescription>
                            ¿Está seguro que desea eliminar la cotización <strong>{deleteQuotation?.number}</strong>?
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

            <Dialog open={!!convertQuotation} onOpenChange={(open) => !open && setConvertQuotation(null)}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Crear factura desde cotización</DialogTitle>
                        <DialogDescription>
                            Se generará una factura real desde {convertQuotation?.number}. La factura afectará inventario y cuentas por cobrar.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Tipo de NCF *</Label>
                            <Select value={invoiceNcfType} onValueChange={(value) => setInvoiceNcfType(value as NCFType)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(NCF_TYPES).map(([key, value]) => (
                                        <SelectItem key={key} value={key}>
                                            {key} - {value}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="invoice-due-date">Fecha de vencimiento *</Label>
                            <Input
                                id="invoice-due-date"
                                type="date"
                                value={invoiceDueDate}
                                onChange={(event) => setInvoiceDueDate(event.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setConvertQuotation(null)} disabled={isConverting} className="w-full sm:w-auto">
                            Cancelar
                        </Button>
                        <Button onClick={handleConvertToInvoice} disabled={isConverting} className="w-full sm:w-auto">
                            {isConverting ? "Creando..." : "Crear Factura"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
