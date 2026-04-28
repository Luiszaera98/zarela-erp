"use client";

import React, { useState, useTransition, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, ShieldOff, ShieldCheck, RefreshCw, ArrowRightLeft, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

interface ContingencyInvoice {
  id: string;
  number: string;
  ncf: string;
  ncfType: string;
  clientName: string;
  total: number;
  date: string;
}

export function ContingencyPanel() {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [active, setActive] = useState(false);
  const [invoices, setInvoices] = useState<ContingencyInvoice[]>([]);
  const [reason, setReason] = useState('');
  const [type, setType] = useState<'total' | 'parcial'>('total');
  const [loading, setLoading] = useState(true);
  const [replacingId, setReplacingId] = useState<string | null>(null);

  const loadStatus = async () => {
    try {
      const { getContingencyStatus, getContingencyInvoices } = await import('@/lib/actions/ecfContingencyActions');
      const status = await getContingencyStatus();
      setActive(status.active);
      setReason(status.reason || '');
      setType(status.type || 'total');

      const invs = await getContingencyInvoices();
      setInvoices(invs);
    } catch (err) {
      console.error('Error loading contingency status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleActivate = () => {
    startTransition(async () => {
      const { activateContingency } = await import('@/lib/actions/ecfContingencyActions');
      const result = await activateContingency(type, reason || 'Falla en el sistema e-CF');
      if (result.success) {
        toast({ title: '⚠️ Contingencia Activada', description: result.message });
        setActive(true);
      }
    });
  };

  const handleDeactivate = () => {
    startTransition(async () => {
      const { deactivateContingency } = await import('@/lib/actions/ecfContingencyActions');
      const result = await deactivateContingency();
      if (result.success) {
        toast({ title: '✅ Contingencia Desactivada', description: result.message });
        setActive(false);
        loadStatus();
      } else {
        toast({ title: 'Error', description: result.message, variant: 'destructive' });
      }
    });
  };

  const handleReplaceOne = async (invoiceId: string, ncfType: string) => {
    setReplacingId(invoiceId);
    try {
      const { replaceContingencyInvoice } = await import('@/lib/actions/ecfContingencyActions');
      const newNcfType = ncfType === 'B01' ? 'E31' : 'E32';
      const result = await replaceContingencyInvoice(invoiceId, newNcfType as 'E31' | 'E32');
      if (result.success) {
        toast({ title: 'Factura Reemplazada', description: result.message });
        loadStatus();
      } else {
        toast({ title: 'Error', description: result.message, variant: 'destructive' });
      }
    } finally {
      setReplacingId(null);
    }
  };

  const handleReplaceAll = () => {
    startTransition(async () => {
      const { replaceAllContingencyInvoices } = await import('@/lib/actions/ecfContingencyActions');
      const result = await replaceAllContingencyInvoices();
      toast({
        title: result.success ? 'Reemplazo Completado' : 'Reemplazo Parcial',
        description: result.message,
        variant: result.success ? 'default' : 'destructive',
      });
      loadStatus();
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={active ? 'border-orange-400 dark:border-orange-600' : ''}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {active ? (
              <AlertTriangle className="h-5 w-5 text-orange-500" />
            ) : (
              <ShieldCheck className="h-5 w-5 text-green-500" />
            )}
            <div>
              <CardTitle>Contingencia e-CF</CardTitle>
              <CardDescription>
                Gestión del modo contingencia según Sección 18 del Informe Técnico DGII
              </CardDescription>
            </div>
          </div>
          <Badge
            variant="outline"
            className={active
              ? 'bg-orange-50 text-orange-700 border-orange-400 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-600'
              : 'bg-green-50 text-green-700 border-green-400 dark:bg-green-950 dark:text-green-400 dark:border-green-600'
            }
          >
            {active ? '⚠️ Contingencia Activa' : '✅ Operación Normal'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Activate / Deactivate */}
        {!active ? (
          <div className="flex items-center gap-4">
            <select
              className="border rounded-md px-3 py-2 text-sm bg-background"
              value={type}
              onChange={(e) => setType(e.target.value as 'total' | 'parcial')}
            >
              <option value="total">Contingencia Total</option>
              <option value="parcial">Contingencia Parcial</option>
            </select>
            <input
              type="text"
              placeholder="Razón de la contingencia..."
              className="border rounded-md px-3 py-2 text-sm flex-1 bg-background"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={isPending}>
                  <ShieldOff className="h-4 w-4 mr-2" />
                  Activar Contingencia
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Activar Modo Contingencia?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Las nuevas facturas electrónicas (E31, E32) se emitirán con NCF serie B (B01, B02)
                    hasta que se desactive la contingencia. Estas facturas deberán ser reemplazadas por
                    e-NCF cuando se restablezca el servicio.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleActivate} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Activar Contingencia
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : (
          <div className="flex items-center justify-between bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900 rounded-lg p-4">
            <div>
              <p className="text-sm font-medium text-orange-800 dark:text-orange-400">
                Modo contingencia {type === 'total' ? 'TOTAL' : 'PARCIAL'} activo
              </p>
              <p className="text-xs text-orange-600 dark:text-orange-500 mt-1">
                {reason || 'Sin razón especificada'}
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="border-green-400 text-green-700 hover:bg-green-50" disabled={isPending}>
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Desactivar Contingencia
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Desactivar Contingencia?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se restablecerá la emisión electrónica normal. Las facturas emitidas
                    en contingencia seguirán pendientes de reemplazo.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeactivate}>
                    Desactivar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {/* Pending replacement invoices */}
        {invoices.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4" />
                Facturas de Contingencia Pendientes de Reemplazo ({invoices.length})
              </h4>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" disabled={isPending || active}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${isPending ? 'animate-spin' : ''}`} />
                    Reemplazar Todas
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Reemplazar todas las facturas de contingencia?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Se generarán e-NCF para las {invoices.length} factura(s) pendientes y se
                      enviarán a la DGII con CódigoModificación = 4 (Reemplazo de contingencia).
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleReplaceAll}>
                      Reemplazar Todas
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Factura</TableHead>
                    <TableHead>NCF Contingencia</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-[120px] text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.number}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-orange-600 border-orange-300">
                          {inv.ncf}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{inv.clientName}</TableCell>
                      <TableCell className="text-right font-medium">
                        ${inv.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          disabled={replacingId === inv.id || active}
                          onClick={() => handleReplaceOne(inv.id, inv.ncfType)}
                        >
                          {replacingId === inv.id ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <ArrowRightLeft className="h-3 w-3 mr-1" />
                          )}
                          Reemplazar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
