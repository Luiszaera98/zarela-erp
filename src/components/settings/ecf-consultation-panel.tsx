"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Search, Building2, FileCheck2 } from "lucide-react";
import { queryECFDocument, lookupBuyerDirectory } from "@/lib/actions/ecfActions";
import { Badge } from "@/components/ui/badge";

export function EcfConsultationPanel() {
  // Directorio State
  const [dirRnc, setDirRnc] = useState("");
  const [dirLoading, setDirLoading] = useState(false);
  const [dirResult, setDirResult] = useState<any>(null);

  // ECF State
  const [ecfRncEmisor, setEcfRncEmisor] = useState("");
  const [ecfRncComprador, setEcfRncComprador] = useState("");
  const [ecfEncf, setEcfEncf] = useState("");
  const [ecfLoading, setEcfLoading] = useState(false);
  const [ecfResult, setEcfResult] = useState<any>(null);
  const [ecfError, setEcfError] = useState<string | null>(null);

  const handleDirectorySearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirRnc) return;
    
    setDirLoading(true);
    setDirResult(null);
    try {
      const res = await lookupBuyerDirectory(dirRnc);
      setDirResult(res);
    } catch (err: any) {
      setDirResult({ success: false, message: err.message });
    } finally {
      setDirLoading(false);
    }
  };

  const handleEcfSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ecfRncEmisor || !ecfEncf) return;
    
    setEcfLoading(true);
    setEcfResult(null);
    setEcfError(null);
    try {
      const res = await queryECFDocument(ecfRncEmisor, ecfRncComprador, ecfEncf);
      if (res.success) {
        setEcfResult(res.data);
      } else {
        setEcfError(res.message || "Error al consultar documento.");
      }
    } catch (err: any) {
      setEcfError(err.message);
    } finally {
      setEcfLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Search className="h-5 w-5 text-primary" />
          <CardTitle>Consultas Oficiales DGII</CardTitle>
        </div>
        <CardDescription>
          Servicios de verificación y consulta al web service de la DGII.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="directory" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="directory" className="gap-2">
              <Building2 className="h-4 w-4" />
              Directorio de Contribuyentes
            </TabsTrigger>
            <TabsTrigger value="document" className="gap-2">
              <FileCheck2 className="h-4 w-4" />
              Validador de e-CF
            </TabsTrigger>
          </TabsList>

          {/* TAB: DIRECTORIO */}
          <TabsContent value="directory" className="space-y-4">
            <form onSubmit={handleDirectorySearch} className="flex gap-4 items-end">
              <div className="space-y-2 flex-1">
                <Label htmlFor="dirRnc">RNC ó Cédula del Contribuyente</Label>
                <Input 
                  id="dirRnc" 
                  placeholder="Ej: 130000000" 
                  value={dirRnc}
                  onChange={(e) => setDirRnc(e.target.value)}
                  maxLength={11}
                />
              </div>
              <Button type="submit" disabled={dirLoading || !dirRnc}>
                {dirLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                Consultar
              </Button>
            </form>

            {dirResult && (
              <div className="mt-4 p-4 border rounded-md">
                {dirResult.success && dirResult.data ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b pb-2">
                      <div className="font-semibold text-lg">{dirResult.data[0]?.nombre || 'Entidad Encontrada'}</div>
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        Habilitado e-CF
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm mt-2">
                      <div>
                        <span className="text-muted-foreground block mb-1">RNC:</span>
                        <span className="font-mono">{dirResult.data[0]?.rnc}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-muted-foreground block mb-1">URL Recepción Comprobantes:</span>
                        <span className="text-blue-600 font-mono break-all bg-slate-50 p-1 rounded">
                          {dirResult.data[0]?.urlRecepcion || 'No especificada'}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-muted-foreground block mb-1">URL Aprobación Comercial:</span>
                        <span className="text-purple-600 font-mono break-all bg-slate-50 p-1 rounded">
                          {dirResult.data[0]?.urlAceptacion || 'No especificada'}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-rose-600 font-medium py-2">
                    {dirResult.message || "El contribuyente no fue encontrado en el directorio e-CF."}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* TAB: VALIDADOR DE DOCUMENTOS */}
          <TabsContent value="document" className="space-y-4">
            <form onSubmit={handleEcfSearch} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ecfRncEmisor">RNC Emisor</Label>
                  <Input 
                    id="ecfRncEmisor" 
                    placeholder="RNC del negocio que facturó" 
                    value={ecfRncEmisor}
                    onChange={(e) => setEcfRncEmisor(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ecfEncf">Número de Comprobante (e-NCF)</Label>
                  <Input 
                    id="ecfEncf" 
                    placeholder="Ej: E3100000001" 
                    value={ecfEncf}
                    onChange={(e) => setEcfEncf(e.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="ecfRncComprador">RNC Comprador (Opcional si es consumo)</Label>
                  <Input 
                    id="ecfRncComprador" 
                    placeholder="Tu RNC ó Cédula" 
                    value={ecfRncComprador}
                    onChange={(e) => setEcfRncComprador(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={ecfLoading || !ecfRncEmisor || !ecfEncf}>
                  {ecfLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                  Validar Comprobante
                </Button>
              </div>
            </form>

            {ecfError && (
              <div className="mt-4 p-4 border border-red-200 bg-red-50 text-red-700 rounded-md">
                {ecfError}
              </div>
            )}

            {ecfResult && (
              <div className="mt-4 border rounded-md overflow-hidden shadow-sm">
                <div className={`p-3 font-semibold text-white ${ecfResult.estado?.includes('Aceptado') ? 'bg-green-600' : 'bg-amber-600'}`}>
                  Estado DGII: {ecfResult.estado || 'Recibido'}
                </div>
                <div className="p-4 bg-card space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-y-3">
                    <div>
                      <span className="text-muted-foreground block text-xs">e-NCF</span>
                      <span className="font-mono">{ecfResult.encf || ecfEncf}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-xs">RNC Emisor</span>
                      <span>{ecfResult.rncEmisor || ecfRncEmisor}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-xs">Monto Total</span>
                      <span className="font-semibold text-base">${ecfResult.montoTotal || '---'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-xs">Código Seguridad</span>
                      <span className="font-mono">{ecfResult.codigoSeguridad || '---'}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
