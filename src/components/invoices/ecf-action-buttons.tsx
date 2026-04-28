"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
} from "@/components/ui/alert-dialog";
import { Loader2, Send, RefreshCw, CheckCircle, XCircle, Clock, AlertCircle, FileDown, ArrowRight, Search } from "lucide-react";
import { ECFStatus } from "@/types";
import { sendECF, checkECFStatus, sendECFToReceiver, sendExpenseECF, checkExpenseECFStatus } from "@/lib/actions/ecfActions";
import { toast } from "@/hooks/use-toast";

interface EcfActionButtonsProps {
  invoiceId: string;
  ncfType?: string;
  ecfStatus?: ECFStatus;
  ecfTrackId?: string;
  encf?: string;
  documentType?: 'Invoice' | 'CreditNote' | 'DebitNote' | 'Expense';
  onStatusChange?: () => void;
}

// ─── Badge de estado ───────────────────────────────────────────────────────────

const ECF_STATUS_CONFIG: Record<ECFStatus, { label: string; icon: React.ReactNode; className: string }> = {
  Pendiente:          { label: "e-CF Pendiente",           icon: <Clock className="h-3 w-3" />,        className: "border-yellow-400 text-yellow-700 dark:text-yellow-400" },
  Aceptado:           { label: "e-CF Aceptado",            icon: <CheckCircle className="h-3 w-3" />,  className: "border-green-500 text-green-700 dark:text-green-400" },
  AceptadoCondicional:{ label: "e-CF Aceptado Cond.",      icon: <AlertCircle className="h-3 w-3" />,  className: "border-blue-400 text-blue-700 dark:text-blue-400" },
  Rechazado:          { label: "e-CF Rechazado",           icon: <XCircle className="h-3 w-3" />,      className: "border-red-500 text-red-700 dark:text-red-400" },
  Contingencia:       { label: "e-CF Contingencia",        icon: <AlertCircle className="h-3 w-3" />,  className: "border-orange-400 text-orange-700 dark:text-orange-400" },
};

export function EcfStatusBadge({ ecfStatus }: { ecfStatus?: ECFStatus }) {
  if (!ecfStatus) return null;
  const cfg = ECF_STATUS_CONFIG[ecfStatus];
  return (
    <Badge variant="outline" className={`flex items-center gap-1 text-xs ${cfg.className}`}>
      {cfg.icon}
      {cfg.label}
    </Badge>
  );
}

// ─── Botones de acción e-CF ────────────────────────────────────────────────────

export function EcfActionButtons({
  invoiceId,
  ncfType,
  ecfStatus,
  ecfTrackId,
  encf,
  documentType = 'Invoice',
  onStatusChange,
}: EcfActionButtonsProps) {
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [sendingToReceiver, setSendingToReceiver] = useState(false);

  // Solo mostrar para tipos e-NCF
  const isElectronic = ncfType?.startsWith("E");
  if (!isElectronic) return null;

  const canSend = !ecfStatus || ecfStatus === "Rechazado" || (ecfStatus === "Pendiente" && !ecfTrackId);
  const canCheck = !!ecfTrackId && ecfStatus === "Pendiente";
  const canDownloadRI = !!encf; // Can download RI once e-NCF is assigned
  // Can send to receiver only for E31 (Crédito Fiscal) when accepted by DGII
  const canSendToReceiver = ncfType === 'E31' && (ecfStatus === 'Aceptado' || ecfStatus === 'AceptadoCondicional') && !!encf;

  const handleSend = async () => {
    setSending(true);
    try {
      const result = documentType === 'Expense' 
        ? await sendExpenseECF(invoiceId)
        : await sendECF(invoiceId);
        
      if (result.success) {
        toast({
          title: "e-CF enviado correctamente",
          description: `TrackId: ${result.trackId} — eNCF: ${result.encf}`,
        });
        onStatusChange?.();
      } else {
        toast({
          title: "Error al enviar e-CF",
          description: result.message,
          variant: "destructive",
        });
      }
    } finally {
      setSending(false);
    }
  };

  const handleCheck = async () => {
    setChecking(true);
    try {
      const result = documentType === 'Expense'
        ? await checkExpenseECFStatus(invoiceId)
        : await checkECFStatus(invoiceId);
        
      if (result.success) {
        toast({
          title: "Estado actualizado",
          description: result.message,
        });
        onStatusChange?.();
      } else {
        toast({
          title: "Error al consultar estado",
          description: result.message,
          variant: "destructive",
        });
      }
    } finally {
      setChecking(false);
    }
  };

  const handleSendToReceiver = async () => {
    setSendingToReceiver(true);
    try {
      const result = await sendECFToReceiver(invoiceId);
      if (result.success) {
        toast({
          title: "e-CF enviado al receptor",
          description: result.message,
        });
      } else {
        toast({
          title: "Error al enviar al receptor",
          description: result.message,
          variant: "destructive",
        });
      }
    } finally {
      setSendingToReceiver(false);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Badge de estado actual */}
      <EcfStatusBadge ecfStatus={ecfStatus} />

      {/* Botón enviar */}
      {canSend && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs h-7 border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
              disabled={sending}
            >
              {sending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Send className="h-3 w-3" />
              )}
              {ecfTrackId ? "Reenviar e-CF" : "Enviar e-CF"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Enviar Comprobante Electrónico?</AlertDialogTitle>
              <AlertDialogDescription>
                Se firmará digitalmente esta factura y se enviará a la DGII como un{" "}
                <strong>{ncfType}</strong>. Una vez enviado, el e-NCF quedará registrado en la DGII.
                {ecfStatus === "Rechazado" && (
                  <span className="block mt-2 text-red-600 dark:text-red-400">
                    ⚠️ Esta factura fue rechazada anteriormente. Se intentará reenviar.
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleSend} disabled={sending}>
                {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Confirmar Envío
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Botón consultar estado */}
      {canCheck && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 text-xs h-7"
                onClick={handleCheck}
                disabled={checking}
              >
                {checking ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                Actualizar Estado
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Consultar estado en DGII</p>
              {ecfTrackId && <p className="text-xs text-muted-foreground">{ecfTrackId}</p>}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {/* Botón descargar Representación Impresa */}
      {canDownloadRI && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 text-xs h-7 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950"
                onClick={() => window.open(`/api/ecf/ri/${invoiceId}`, '_blank')}
              >
                <FileDown className="h-3 w-3" />
                RI
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Descargar Representación Impresa (PDF)</p>
              <p className="text-xs text-muted-foreground">Formato obligatorio DGII con QR</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Botón descargar XML firmado */}
      {encf && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 text-xs h-7 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950"
                onClick={() => window.open(`/api/ecf/download?invoiceId=${invoiceId}&type=${documentType}`, '_blank')}
              >
                <FileDown className="h-3 w-3" />
                XML
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Descargar XML Firmado</p>
              <p className="text-xs text-muted-foreground">Necesario para carga manual (E32 &lt; 250k)</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {/* Botón enviar al receptor (solo E31 aceptados) */}
      {canSendToReceiver && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 text-xs h-7 text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950"
                onClick={handleSendToReceiver}
                disabled={sendingToReceiver}
              >
                {sendingToReceiver ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <ArrowRight className="h-3 w-3" />
                )}
                Receptor
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Enviar e-CF al sistema del comprador</p>
              <p className="text-xs text-muted-foreground">Flujo Emisor→Receptor DGII</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
