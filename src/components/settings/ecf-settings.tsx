"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Shield,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  FileDigit,
  Wifi,
} from "lucide-react";
import { getECFConfiguration, testDGIIConnection } from "@/lib/actions/ecfActions";

interface ECFConfig {
  isConfigured: boolean;
  environment: string;
  rncEmisor: string;
  razonSocial: string;
}

const ENV_LABELS: Record<string, { label: string; color: string }> = {
  TesteCF: { label: "Pruebas (Test)", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  CerteCF: { label: "Certificación", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  eCF:     { label: "Producción", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
};

export function EcfSettings() {
  const [config, setConfig] = useState<ECFConfig | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getECFConfiguration().then((c) => {
      setConfig(c);
      setLoading(false);
    });
  }, []);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await testDGIIConnection();
    setTestResult(result);
    setTesting(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const envInfo = config ? (ENV_LABELS[config.environment] ?? ENV_LABELS["TesteCF"]) : ENV_LABELS["TesteCF"];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileDigit className="h-5 w-5 text-primary" />
          <CardTitle>Facturación Electrónica (e-CF)</CardTitle>
        </div>
        <CardDescription>
          Configuración del sistema de Comprobantes Fiscales Electrónicos de la DGII (República Dominicana)
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Estado del certificado */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${config?.isConfigured ? "bg-green-100 dark:bg-green-900" : "bg-red-100 dark:bg-red-900"}`}>
              {config?.isConfigured
                ? <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                : <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              }
            </div>
            <div>
              <p className="font-medium text-sm">Certificado Digital (.p12)</p>
              <p className="text-xs text-muted-foreground">
                {config?.isConfigured
                  ? "Certificado configurado correctamente"
                  : "No configurado — Agrega ECF_CERTIFICATE_BASE64 en .env.local"
                }
              </p>
            </div>
          </div>
          <Badge className={envInfo.color} variant="outline">
            {envInfo.label}
          </Badge>
        </div>

        <Separator />

        {/* Información del emisor */}
        <div className="grid gap-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">RNC Emisor</span>
            <span className="font-mono font-medium">
              {config?.rncEmisor || <span className="text-muted-foreground italic">No configurado</span>}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Razón Social</span>
            <span className="font-medium">
              {config?.razonSocial || <span className="text-muted-foreground italic">No configurado</span>}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Ambiente DGII</span>
            <span className="font-medium">{config?.environment || "TesteCF"}</span>
          </div>
        </div>

        <Separator />

        {/* Probar conexión */}
        <div className="space-y-3">
          <Button
            onClick={handleTestConnection}
            disabled={testing || !config?.isConfigured}
            variant="outline"
            className="w-full"
          >
            {testing ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Autenticando con DGII...</>
            ) : (
              <><Wifi className="mr-2 h-4 w-4" /> Probar Conexión DGII</>
            )}
          </Button>

          {!config?.isConfigured && (
            <p className="text-xs text-center text-muted-foreground">
              Configura el certificado primero para probar la conexión
            </p>
          )}

          {testResult && (
            <div className={`flex items-start gap-2 rounded-md p-3 text-sm ${
              testResult.success
                ? "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200"
                : "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200"
            }`}>
              {testResult.success
                ? <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
                : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              }
              <span>{testResult.message}</span>
            </div>
          )}
        </div>

        <Separator />

        {/* Instrucciones de configuración */}
        {!config?.isConfigured && (
          <div className="rounded-lg border border-dashed bg-muted/30 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Shield className="h-4 w-4" />
              Cómo configurar el certificado
            </div>
            <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
              <li>Obtén tu certificado <strong>.p12</strong> en <a href="https://www.camarasantodomingo.do/digifirma/FormularioWeb/" target="_blank" rel="noopener noreferrer" className="underline text-primary">DigiFirma</a></li>
              <li>Conviértelo a Base64:<br />
                <code className="bg-muted px-1 rounded text-xs">certutil -encode cert.p12 cert_b64.txt</code>
              </li>
              <li>Agrega las siguientes variables en tu <strong>.env.local</strong>:
                <pre className="mt-1 bg-muted p-2 rounded text-xs overflow-x-auto">{`ECF_ENVIRONMENT=TesteCF
ECF_RNC_EMISOR=tu_rnc_aqui
ECF_CERTIFICATE_BASE64=contenido_del_txt
ECF_CERTIFICATE_PASSPHRASE=tu_password
ECF_RAZON_SOCIAL=Tu Empresa SRL`}</pre>
              </li>
              <li>Reinicia el servidor de Next.js</li>
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
