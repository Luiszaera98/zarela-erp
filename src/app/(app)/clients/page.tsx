"use client";

import React, { useState, useEffect, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Mail, MoreHorizontal, Phone, Search, Edit, Trash2, Filter, UsersRound } from 'lucide-react';
import type { Client, ContactType } from '@/types';
import { CONTACT_TYPES } from '@/types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getClients, deleteClientAction } from '@/lib/actions/clientActions';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { CreateClientDialog } from '@/components/clients/create-client-dialog';
import { EditClientDialog } from '@/components/clients/edit-client-dialog';

export default function ClientsPage() {
    console.log('--- CLIENTS PAGE JS LOADED - VERSION 8 - PREMIUM UI ---', new Date().toISOString());

    const [clients, setClients] = useState<Client[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<ContactType | 'Todos'>('Todos');
    const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
    const [clientToEdit, setClientToEdit] = useState<Client | null>(null);
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    // Pagination State
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalClients, setTotalClients] = useState(0);

    const fetchClientsData = async () => {
        setIsLoading(true);
        try {
            const result = await getClients(page, 20, searchTerm, typeFilter);
            setClients(result.clients.map(c => ({
                ...c,
                createdAt: new Date(c.createdAt),
                updatedAt: new Date(c.updatedAt),
            })));
            setTotalPages(result.totalPages);
            setTotalClients(result.total);
        } catch (error) {
            console.error("Failed to fetch clients", error);
            toast({ title: "Error", description: "No se pudieron cargar los contactos.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchClientsData();
        }, 300);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, searchTerm, typeFilter]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setPage(1);
    };

    const handleTypeChange = (value: string) => {
        setTypeFilter(value as ContactType | 'Todos');
        setPage(1);
    };

    const handleDeleteConfirmation = () => {
        if (!clientToDelete) return;
        startTransition(async () => {
            const result = await deleteClientAction(clientToDelete.id);
            if (result.success) {
                toast({
                    title: "Contacto Eliminado",
                    description: "El contacto \"" + clientToDelete.name + "\" ha sido eliminado.",
                });
                await fetchClientsData();
            } else {
                toast({
                    title: "Error al Eliminar",
                    description: result.message || "No se pudo eliminar el contacto. Verifique si tiene facturas asociadas.",
                    variant: "destructive",
                });
            }
            setClientToDelete(null);
        });
    };

    const getBadgeVariant = (type: ContactType) => {
        switch (type) {
            case 'Cliente': return 'default';
            case 'Proveedor': return 'secondary';
            case 'Empleado': return 'outline';
            default: return 'outline';
        }
    };

    return (
        <div className="mx-auto max-w-7xl space-y-4 md:space-y-8">
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center md:gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Contactos</h1>
                    <p className="mt-1 text-sm text-muted-foreground md:text-base">Gestione sus clientes, proveedores y empleados ({totalClients} registros).</p>
                </div>
                <CreateClientDialog onClientCreated={fetchClientsData} />
            </div>

            <Card className="border shadow-sm bg-card md:border-none md:shadow-xl md:bg-card/50 md:backdrop-blur-sm md:ring-1 md:ring-black/5">
                <CardHeader className="p-4 pb-3 md:p-6 md:pb-4">
                    <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between md:gap-4">
                        <div className="relative w-full sm:max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Buscar contacto..."
                                value={searchTerm}
                                onChange={handleSearchChange}
                                className="pl-10 w-full bg-background/50 border-muted focus:border-primary transition-colors"
                            />
                        </div>
                        <Select value={typeFilter} onValueChange={handleTypeChange}>
                            <SelectTrigger className="w-full sm:w-[200px] bg-background/50 border-muted">
                                <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
                                <SelectValue placeholder="Filtrar por tipo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Todos">Todos los Tipos</SelectItem>
                                {CONTACT_TYPES.map(type => (
                                    <SelectItem key={type} value={type}>{type}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
                    <div className="hidden rounded-md border border-muted overflow-hidden md:block">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="font-semibold">Nombre / Razón Social</TableHead>
                                    <TableHead className="font-semibold">Tipo</TableHead>
                                    <TableHead className="font-semibold">RNC / Cédula</TableHead>
                                    <TableHead className="font-semibold">Contacto</TableHead>
                                    <TableHead className="text-right font-semibold">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">
                                            <div className="flex justify-center items-center">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : clients.length > 0 ? (
                                    clients.map((client) => (
                                        <TableRow key={client.id} className="hover:bg-muted/30 transition-colors">
                                            <TableCell className="font-medium text-foreground">
                                                <div className="flex flex-col">
                                                    <span className="text-base">{client.name}</span>
                                                    <span className="text-xs text-muted-foreground sm:hidden">{client.rncCedula}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={getBadgeVariant(client.contactType)} className="shadow-sm">
                                                    {client.contactType}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground font-mono text-sm">{client.rncCedula}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-col space-y-1 text-sm text-muted-foreground">
                                                    {client.email && <span>{client.email}</span>}
                                                    {client.phoneNumber && <span>{client.phoneNumber}</span>}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-muted" disabled={isPending}>
                                                            <span className="sr-only">Abrir menú</span>
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-48">
                                                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={() => setClientToEdit(client)} className="cursor-pointer">
                                                            <Edit className="mr-2 h-4 w-4" /> Editar
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onClick={() => setClientToDelete(client)} className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer" disabled={isPending}>
                                                            <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-32 text-center">
                                            <div className="flex flex-col items-center justify-center text-muted-foreground">
                                                <UsersRound className="h-10 w-10 mb-2 opacity-20" />
                                                <p>No se encontraron contactos.</p>
                                                <Button variant="link" onClick={() => { setSearchTerm(''); setTypeFilter('Todos'); setPage(1); }} className="mt-2">
                                                    Limpiar filtros
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="space-y-3 md:hidden">
                        {isLoading ? (
                            <div className="flex h-36 items-center justify-center rounded-md border">
                                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
                            </div>
                        ) : clients.length > 0 ? (
                            clients.map((client) => (
                                <div key={client.id} className="rounded-md border bg-background p-4 shadow-sm">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 space-y-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h2 className="truncate text-base font-semibold leading-tight">{client.name}</h2>
                                                <Badge variant={getBadgeVariant(client.contactType)}>{client.contactType}</Badge>
                                            </div>
                                            <p className="font-mono text-xs text-muted-foreground">{client.rncCedula || "Sin RNC / cédula"}</p>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-9 w-9 shrink-0 p-0" disabled={isPending}>
                                                    <span className="sr-only">Abrir menú</span>
                                                    <MoreHorizontal className="h-5 w-5" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48">
                                                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => setClientToEdit(client)} className="cursor-pointer">
                                                    <Edit className="mr-2 h-4 w-4" /> Editar
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => setClientToDelete(client)} className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer" disabled={isPending}>
                                                    <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>

                                    {(client.phoneNumber || client.email) && (
                                        <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                                            {client.phoneNumber && (
                                                <a href={`tel:${client.phoneNumber}`} className="flex items-center gap-2 rounded-md bg-muted/60 px-3 py-2">
                                                    <Phone className="h-4 w-4" />
                                                    <span className="truncate">{client.phoneNumber}</span>
                                                </a>
                                            )}
                                            {client.email && (
                                                <a href={`mailto:${client.email}`} className="flex items-center gap-2 rounded-md bg-muted/60 px-3 py-2">
                                                    <Mail className="h-4 w-4" />
                                                    <span className="truncate">{client.email}</span>
                                                </a>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="flex min-h-40 flex-col items-center justify-center rounded-md border px-4 text-center text-muted-foreground">
                                <UsersRound className="mb-2 h-10 w-10 opacity-20" />
                                <p>No se encontraron contactos.</p>
                                <Button variant="link" onClick={() => { setSearchTerm(''); setTypeFilter('Todos'); setPage(1); }} className="mt-2">
                                    Limpiar filtros
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Pagination Controls */}
                    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-end sm:space-x-2">
                        <div className="flex-1 text-sm text-muted-foreground">
                            Página {page} de {totalPages}
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:block sm:space-x-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1 || isLoading}
                            >
                                Anterior
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages || isLoading}
                            >
                                Siguiente
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {clientToDelete && (
                <AlertDialog open={!!clientToDelete} onOpenChange={(open) => !open && setClientToDelete(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar contacto?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta acción eliminará permanentemente a <strong>{clientToDelete.name}</strong> y todos sus datos asociados.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setClientToDelete(null)} disabled={isPending}>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteConfirmation} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground" disabled={isPending}>
                                {isPending ? "Eliminando..." : "Sí, eliminar"}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}

            {clientToEdit && (
                <EditClientDialog
                    client={clientToEdit}
                    open={!!clientToEdit}
                    onOpenChange={(open) => !open && setClientToEdit(null)}
                    onClientUpdated={fetchClientsData}
                />
            )}
        </div>
    );
}
