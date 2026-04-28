"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { importInvoiceFromJSON, importBulkInvoices } from "@/lib/actions/invoiceActions";
import { useToast } from "@/hooks/use-toast";

export function ImportInvoiceButton() {
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const text = await file.text();
            const data = JSON.parse(text);

            if (Array.isArray(data)) {
                // Bulk import
                const result = await importBulkInvoices(data);
                if (result.success) {
                    toast({
                        title: "Importación Masiva Completada",
                        description: `Se importaron ${result.count} facturas. ${result.errors.length} errores.`,
                    });
                    if (result.errors.length > 0) {
                        console.error("Errores de importación:", result.errors);
                    }
                }
            } else {
                // Single import
                const result = await importInvoiceFromJSON(data);

                if (result.success) {
                    toast({
                        title: "Factura Importada",
                        description: "La factura se ha importado correctamente.",
                    });
                } else {
                    toast({
                        title: "Error",
                        description: result.message,
                        variant: "destructive",
                    });
                }
            }
        } catch (error) {
            console.error("Error parsing JSON:", error);
            toast({
                title: "Error",
                description: "El archivo no es un JSON válido o hubo un error al procesarlo.",
                variant: "destructive",
            });
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    return (
        <>
            <input
                type="file"
                accept=".json"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
            />
            <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
            >
                <Upload className="mr-2 h-4 w-4" />
                {isUploading ? "Importando..." : "Importar JSON"}
            </Button>
        </>
    );
}
