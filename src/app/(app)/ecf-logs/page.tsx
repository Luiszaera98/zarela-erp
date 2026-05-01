"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, ServerCrash, Clock, ShieldAlert, FileSearch, CheckCircle2, XCircle, ChevronRight, Navigation, Activity } from 'lucide-react';
import { getGlobalEcfAuditLogs } from '@/lib/actions/ecfActions';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { EcfAuditDialog } from '@/components/invoices/ecf-audit-dialog';
import { EcfConsultationPanel } from '@/components/settings/ecf-consultation-panel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from 'next/link';

export default function EcfLogsPage() {
    const [logs, setLogs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('Todos');
    
    // Pagination
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalLogs, setTotalLogs] = useState(0);

    // Expansion Dialog
    const [auditDocumentId, setAuditDocumentId] = useState<string | null>(null);

    const fetchLogs = async () => {
        setIsLoading(true);
        try {
            const result = await getGlobalEcfAuditLogs(page, 20, statusFilter, searchTerm);
            if (result.success) {
                setLogs(result.logs || []);
                setTotalPages(result.totalPages || 1);
                setTotalLogs(result.total || 0);
            }
        } catch (error) {
            console.error("Error fetching logs", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchLogs();
        }, 300);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, statusFilter, searchTerm]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setPage(1);
    };

    const handleStatusChange = (value: string) => {
        setStatusFilter(value);
        setPage(1);
    };

    const getActionBadge = (action: string) => {
        switch (action) {
            case 'SEND_ECF': return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Envío e-CF</Badge>;
            case 'CHECK_STATUS': return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Consulta Estado</Badge>;
            case 'RECEIVE_ARECF': return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Recibo ARECF</Badge>;
            default: return <Badge variant="outline">{action}</Badge>;
        }
    };

    return (
        <div className="mx-auto max-w-7xl space-y-4 rounded-xl bg-slate-50/50 min-h-screen md:space-y-8 md:p-6">
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center md:gap-4">
                <div>
                    <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-slate-800 md:text-4xl">
                        <ServerCrash className="h-7 w-7 text-indigo-600 md:h-8 md:w-8" />
                        Auditoría e-CF
                    </h1>
                    <p className="mt-1 text-sm text-slate-500 md:text-base">Monitorización global de transacciones con los servidores de la DGII.</p>
                </div>
            </div>

            <Tabs defaultValue="monitor" className="w-full">
                <TabsList className="mb-4 grid h-auto w-full grid-cols-2 md:mb-6 md:w-1/2 lg:w-1/3">
                    <TabsTrigger value="monitor" className="gap-2">
                        <Activity className="h-4 w-4" />
                        Monitor de Transacciones
                    </TabsTrigger>
                    <TabsTrigger value="consults" className="gap-2">
                        <FileSearch className="h-4 w-4" />
                        Consultas Rápidas
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="monitor" className="space-y-4">
                    <Card className="border-slate-100 bg-white shadow-sm">
                <CardHeader className="pb-4">
                    <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
                        <div className="relative w-full md:max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por e-NCF, Track ID o Mensaje..."
                                value={searchTerm}
                                onChange={handleSearchChange}
                                className="pl-10 border-slate-200 focus:border-slate-400"
                            />
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                            <Select value={statusFilter} onValueChange={handleStatusChange}>
                                <SelectTrigger className="w-full sm:w-[150px] border-slate-200">
                                    <SelectValue placeholder="Estado Múltiple" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Todos">Todos</SelectItem>
                                    <SelectItem value="SUCCESS">Exitósos</SelectItem>
                                    <SelectItem value="ERROR">Errores (Fallidos)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3 md:hidden">
                        {isLoading ? (
                            <div className="rounded-md border border-slate-100 bg-white p-8 text-center">
                                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600"></div>
                            </div>
                        ) : logs.length > 0 ? (
                            logs.map((log) => (
                                <div key={`mobile-${log.id}`} className="rounded-md border border-slate-100 bg-white p-4 shadow-sm">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                {log.status === 'SUCCESS'
                                                    ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                                    : <XCircle className="h-5 w-5 text-rose-500" />
                                                }
                                                {getActionBadge(log.action)}
                                            </div>
                                            <p className="mt-2 font-mono text-sm text-slate-700">{log.encf || '-'}</p>
                                            {log.documentType && (
                                                <p className="text-[10px] uppercase text-slate-400">{log.documentType}</p>
                                            )}
                                        </div>
                                        <div className="flex shrink-0 items-center gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-indigo-600"
                                                onClick={() => setAuditDocumentId(log.documentId)}
                                                title="Ver Payloads Completos"
                                            >
                                                <FileSearch className="h-4 w-4" />
                                            </Button>
                                            {log.documentId && log.documentType !== 'Other' && (
                                                <Link href={log.documentType === 'Invoice' ? `/invoices` : `/expenses`}>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500">
                                                        <Navigation className="h-4 w-4" />
                                                    </Button>
                                                </Link>
                                            )}
                                        </div>
                                    </div>
                                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <p className="text-xs font-medium uppercase text-slate-400">Fecha</p>
                                            <p className="text-slate-600">{format(new Date(log.createdAt), 'dd MMM yy - HH:mm', { locale: es })}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-medium uppercase text-slate-400">Track ID</p>
                                            <p className="truncate font-mono text-xs text-slate-500">{log.trackId || '-'}</p>
                                        </div>
                                    </div>
                                    <p className={`mt-3 line-clamp-3 text-sm ${log.status === 'ERROR' ? 'font-medium text-rose-600' : 'text-slate-600'}`}>
                                        {log.message || '-'}
                                    </p>
                                </div>
                            ))
                        ) : (
                            <div className="rounded-md border border-slate-100 bg-white p-8 text-center text-slate-400">
                                <ShieldAlert className="mx-auto mb-3 h-12 w-12 opacity-20" />
                                <p className="text-lg font-medium text-slate-600">No hay registros</p>
                                <p className="text-sm">No se encontraron logs de auditoría con los filtros actuales.</p>
                            </div>
                        )}
                    </div>

                    <div className="hidden rounded-md border border-slate-100 overflow-hidden md:block">
                        <Table>
                            <TableHeader className="bg-slate-50/50">
                                <TableRow className="border-slate-100">
                                    <TableHead className="text-slate-500 font-medium w-12 text-center"></TableHead>
                                    <TableHead className="text-slate-500 font-medium">Fecha y Hora</TableHead>
                                    <TableHead className="text-slate-500 font-medium">Acción</TableHead>
                                    <TableHead className="text-slate-500 font-medium">e-NCF / Documento</TableHead>
                                    <TableHead className="text-slate-500 font-medium">Track ID</TableHead>
                                    <TableHead className="text-slate-500 font-medium w-1/3">Detalle / Mensaje</TableHead>
                                    <TableHead className="text-slate-500 font-medium text-center">Payloads</TableHead>
                                    <TableHead className="text-right text-slate-500 font-medium">Ir al Doc</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-32 text-center">
                                            <div className="flex justify-center items-center">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : logs.length > 0 ? (
                                    logs.map((log) => (
                                        <TableRow key={log.id} className="hover:bg-slate-50/50 border-slate-100 group">
                                            <TableCell className="text-center">
                                                {log.status === 'SUCCESS' 
                                                    ? <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto" />
                                                    : <XCircle className="h-5 w-5 text-rose-500 mx-auto" />
                                                }
                                            </TableCell>
                                            <TableCell className="text-slate-600 text-sm whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">
                                                    <Clock className="h-3 w-3 text-slate-400" />
                                                    {format(new Date(log.createdAt), 'dd MMM yy - HH:mm', { locale: es })}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {getActionBadge(log.action)}
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-mono text-sm text-slate-700">{log.encf || '-'}</div>
                                                {log.documentType && (
                                                    <div className="text-[10px] text-slate-400 uppercase">{log.documentType}</div>
                                                )}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs text-slate-500">
                                                {log.trackId || '-'}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                <div className={`line-clamp-2 ${log.status === 'ERROR' ? 'text-rose-600 font-medium' : 'text-slate-600'}`}>
                                                    {log.message || '-'}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => setAuditDocumentId(log.documentId)}
                                                    title="Ver Payloads Completos"
                                                >
                                                    <FileSearch className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {log.documentId && log.documentType !== 'Other' && (
                                                    <Link 
                                                        href={log.documentType === 'Invoice' ? `/invoices` : `/expenses`}
                                                    >
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-700">
                                                            <Navigation className="h-4 w-4" />
                                                        </Button>
                                                    </Link>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-48 text-center">
                                            <div className="flex flex-col items-center justify-center text-slate-400">
                                                <ShieldAlert className="h-12 w-12 mb-3 opacity-20" />
                                                <p className="text-lg font-medium text-slate-600">No hay registros</p>
                                                <p className="text-sm">No se encontraron logs de auditoría con los filtros actuales.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-4">
                        <div className="text-sm text-slate-500">
                            Mostrando {(page - 1) * 20 + 1}-{Math.min(page * 20, totalLogs)} de {totalLogs} incidencias
                        </div>
                        <div className="flex items-center space-x-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1 || isLoading}
                            >
                                Anterior
                            </Button>
                            <div className="text-sm font-medium px-3">
                                {page} / {totalPages}
                            </div>
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
            </TabsContent>

            <TabsContent value="consults" className="space-y-4">
                <EcfConsultationPanel />
            </TabsContent>
            </Tabs>

            {/* Modal Extendido para ver Contexto del Documento */}
            {auditDocumentId && (
                <EcfAuditDialog 
                    documentId={auditDocumentId} 
                    open={!!auditDocumentId} 
                    onOpenChange={(open) => !open && setAuditDocumentId(null)} 
                />
            )}
        </div>
    );
}
