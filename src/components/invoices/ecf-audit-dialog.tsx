"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { getEcfAuditLogs } from "@/lib/actions/ecfActions";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2, Plus, Minus, Search, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EcfAuditDialogProps {
  documentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EcfAuditDialog({ documentId, open, onOpenChange }: EcfAuditDialogProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadLogs();
    }
  }, [open, documentId]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const result = await getEcfAuditLogs(documentId);
      if (result.success) {
        setLogs(result.logs || []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedLog(prev => prev === id ? null : id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-muted-foreground" />
            Auditoría e-CF (Histórico)
          </DialogTitle>
          <DialogDescription>
            Trazabilidad de todos los eventos relacionados con la DGII para este comprobante electrónico.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-4 mt-2 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center p-8 border rounded-md border-dashed text-muted-foreground">
              No hay registros de auditoría para este documento.
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <div key={log.id} className="border rounded-md shadow-sm bg-card overflow-hidden">
                  <div 
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                    onClick={() => toggleExpand(log.id)}
                  >
                    <div className="flex items-start sm:items-center gap-3">
                      {log.status === "SUCCESS" ? (
                        <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 sm:mt-0" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500 mt-0.5 sm:mt-0" />
                      )}
                      <div>
                        <div className="flex items-center gap-2 font-medium">
                          {log.action}
                          <Badge variant="outline" className="text-[10px]">
                            {log.documentType}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {format(new Date(log.createdAt), "PPpp", { locale: es })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="hidden sm:block text-right">
                        {log.encf && <div className="font-mono text-xs">{log.encf}</div>}
                        {log.trackId && <div className="text-xs text-muted-foreground">Track: {log.trackId}</div>}
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        {expandedLog === log.id ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {expandedLog === log.id && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-950 border-t text-sm space-y-3">
                      <div>
                        <span className="font-medium">Mensaje: </span>
                        <span>{log.message || "Sin mensaje"}</span>
                      </div>
                      
                      {log.requestPayload && (
                        <div>
                          <div className="font-medium mb-1 text-xs text-slate-500">Payload Petición:</div>
                          <pre className="bg-slate-900 text-slate-300 p-2 rounded text-xs overflow-x-auto whitespace-pre-wrap max-h-40">
                            {log.requestPayload}
                          </pre>
                        </div>
                      )}
                      
                      {log.responsePayload && (
                        <div>
                          <div className="font-medium mb-1 text-xs text-slate-500">Payload Respuesta:</div>
                          <pre className="bg-slate-900 text-slate-300 p-2 rounded text-xs overflow-x-auto whitespace-pre-wrap max-h-40">
                            {log.responsePayload}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
