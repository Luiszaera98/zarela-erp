"use client";

import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Edit, MoreHorizontal, PlusCircle, Search, Trash2, Wrench } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { createService, deleteServiceAction, getServices, updateService } from '@/lib/actions/serviceActions';
import { Service } from '@/types';

type ServiceForm = {
    name: string;
    category: string;
    description: string;
    price: string;
    billingMode: string;
    status: 'Activo' | 'Inactivo';
};

const SERVICE_CATEGORIES = [
    'Instalación',
    'Mantenimiento',
    'Reparación',
    'Soporte técnico',
    'Consultoría',
    'Transporte',
    'Mano de obra',
    'Garantía',
    'Otros',
];

const SERVICE_BILLING_MODES = [
    'Por servicio',
    'Por visita',
    'Por hora',
    'Mensual',
    'Por proyecto',
];

const emptyForm: ServiceForm = {
    name: '',
    category: 'Mantenimiento',
    description: '',
    price: '',
    billingMode: 'Por servicio',
    status: 'Activo',
};

export default function ServicesPage() {
    const { toast } = useToast();
    const [services, setServices] = useState<Service[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'Todos' | 'Activo' | 'Inactivo'>('Todos');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingService, setEditingService] = useState<Service | null>(null);
    const [deleteService, setDeleteService] = useState<Service | null>(null);
    const [form, setForm] = useState<ServiceForm>(emptyForm);

    const fetchServices = async () => {
        setIsLoading(true);
        const result = await getServices(page, 20, searchTerm, statusFilter);
        setServices(result.services);
        setTotalPages(result.totalPages);
        setIsLoading(false);
    };

    useEffect(() => {
        const timer = setTimeout(fetchServices, 300);
        return () => clearTimeout(timer);
    }, [page, searchTerm, statusFilter]);

    const openCreateDialog = () => {
        setEditingService(null);
        setForm(emptyForm);
        setIsDialogOpen(true);
    };

    const openEditDialog = (service: Service) => {
        setEditingService(service);
        setForm({
            name: service.name,
            category: service.category || 'Otros',
            description: service.description || '',
            price: String(service.price || 0),
            billingMode: service.unit || 'Por servicio',
            status: service.status,
        });
        setIsDialogOpen(true);
    };

    const updateForm = (field: keyof ServiceForm, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async (event: React.FormEvent) => {
        event.preventDefault();
        const price = parseFloat(form.price);

        if (!form.name.trim() || Number.isNaN(price) || price < 0) {
            toast({ title: "Error de validación", description: "Complete el nombre y un precio válido.", variant: "destructive" });
            return;
        }

        setIsSaving(true);
        const payload = {
            name: form.name,
            category: form.category,
            description: form.description,
            price,
            unit: form.billingMode || 'Por servicio',
            status: form.status,
        };

        const result = editingService
            ? await updateService(editingService.id, payload)
            : await createService(payload);

        setIsSaving(false);

        if (result.success) {
            toast({
                title: editingService ? "Servicio actualizado" : "Servicio creado",
                description: `${form.name} está disponible para cotizaciones y facturas.`,
            });
            setIsDialogOpen(false);
            fetchServices();
        } else {
            toast({ title: "Error", description: result.message || "No se pudo guardar el servicio", variant: "destructive" });
        }
    };

    const handleDelete = async () => {
        if (!deleteService) return;
        const result = await deleteServiceAction(deleteService.id);
        if (result.success) {
            toast({ title: "Servicio eliminado", description: result.message });
            fetchServices();
        } else {
            toast({ title: "Error", description: result.message || "No se pudo eliminar el servicio", variant: "destructive" });
        }
        setDeleteService(null);
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight">Servicios</h1>
                    <p className="text-muted-foreground mt-1">Gestione servicios vendibles sin afectar inventario.</p>
                </div>
                <Button className="gap-2" onClick={openCreateDialog}>
                    <PlusCircle className="h-5 w-5" />
                    Nuevo Servicio
                </Button>
            </div>

            <Card className="border-none shadow-md bg-card/50 backdrop-blur-sm">
                <CardHeader className="pb-4">
                    <div className="flex flex-col sm:flex-row items-center gap-4 justify-between">
                        <div className="relative w-full sm:max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por nombre, código o categoría..."
                                value={searchTerm}
                                onChange={(event) => {
                                    setSearchTerm(event.target.value);
                                    setPage(1);
                                }}
                                className="pl-10"
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={(value) => {
                            setStatusFilter(value as 'Todos' | 'Activo' | 'Inactivo');
                            setPage(1);
                        }}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="Estado" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Todos">Todos</SelectItem>
                                <SelectItem value="Activo">Activos</SelectItem>
                                <SelectItem value="Inactivo">Inactivos</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead>Código</TableHead>
                                    <TableHead>Servicio</TableHead>
                                    <TableHead>Categoría</TableHead>
                                    <TableHead>Creación</TableHead>
                                    <TableHead className="text-right">Precio</TableHead>
                                    <TableHead className="text-right">Estado</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center">
                                            <div className="flex justify-center">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : services.length > 0 ? (
                                    services.map(service => (
                                        <TableRow key={service.id} className="hover:bg-muted/30">
                                            <TableCell className="font-mono text-xs text-muted-foreground">{service.code || '-'}</TableCell>
                                            <TableCell>
                                                <div className="font-medium">{service.name}</div>
                                                {service.description && <div className="text-xs text-muted-foreground line-clamp-1">{service.description}</div>}
                                            </TableCell>
                                            <TableCell>{service.category ? <Badge variant="outline">{service.category}</Badge> : '-'}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {service.createdAt ? format(new Date(service.createdAt), 'dd MMM yyyy', { locale: es }) : '-'}
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                                ${service.price.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Badge variant={service.status === 'Activo' ? 'secondary' : 'outline'}>{service.status}</Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="sm">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onClick={() => openEditDialog(service)}>
                                                            <Edit className="h-4 w-4 mr-2" />
                                                            Editar
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => setDeleteService(service)} className="text-destructive focus:text-destructive">
                                                            <Trash2 className="h-4 w-4 mr-2" />
                                                            Eliminar
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-32 text-center">
                                            <div className="flex flex-col items-center justify-center text-muted-foreground">
                                                <Wrench className="h-10 w-10 mb-2 opacity-20" />
                                                <p>No se encontraron servicios.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="flex items-center justify-end gap-2 py-4">
                        <div className="flex-1 text-sm text-muted-foreground">
                            Página {page} de {totalPages}
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setPage(prev => Math.max(1, prev - 1))} disabled={page === 1 || isLoading}>
                            Anterior
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setPage(prev => Math.min(totalPages, prev + 1))} disabled={page === totalPages || isLoading}>
                            Siguiente
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[560px]">
                    <DialogHeader>
                        <DialogTitle>{editingService ? 'Editar Servicio' : 'Crear Servicio'}</DialogTitle>
                        <DialogDescription>Los servicios se venden en facturas y cotizaciones, pero no descuentan inventario.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="service-name">Nombre *</Label>
                                <Input id="service-name" value={form.name} onChange={(event) => updateForm('name', event.target.value)} placeholder="Ej: Mantenimiento preventivo de aire" required />
                            </div>
                            <div className="space-y-2">
                                <Label>Categoría *</Label>
                                <Select value={form.category} onValueChange={(value) => updateForm('category', value)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {SERVICE_CATEGORIES.map(category => (
                                            <SelectItem key={category} value={category}>{category}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="service-price">Precio *</Label>
                                <Input id="service-price" type="number" min="0" step="0.01" value={form.price} onChange={(event) => updateForm('price', event.target.value)} placeholder="0.00" required />
                            </div>
                            <div className="space-y-2">
                                <Label>Forma de cobro</Label>
                                <Select value={form.billingMode} onValueChange={(value) => updateForm('billingMode', value)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {SERVICE_BILLING_MODES.map(mode => (
                                            <SelectItem key={mode} value={mode}>{mode}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Estado</Label>
                                <Select value={form.status} onValueChange={(value) => updateForm('status', value)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Activo">Activo</SelectItem>
                                        <SelectItem value="Inactivo">Inactivo</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="service-description">Descripción</Label>
                                <Textarea id="service-description" value={form.description} onChange={(event) => updateForm('description', event.target.value)} rows={3} placeholder="Detalle que aparecerá en documentos comerciales" />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>Cancelar</Button>
                            <Button type="submit" disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar Servicio'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!deleteService} onOpenChange={(open) => !open && setDeleteService(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Eliminar servicio</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción elimina {deleteService?.name}. Las facturas y cotizaciones existentes conservarán el texto ya guardado.
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
        </div>
    );
}
