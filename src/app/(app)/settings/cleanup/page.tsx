"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cleanupAllPayments } from '@/lib/actions/paymentActions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, DollarSign } from 'lucide-react';

export default function CleanupPage() {
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleCleanup = async () => {
        if (!confirm("¿ESTÁS SEGURO? Esto eliminará TODOS los pagos registrados y reseteará los saldos de las facturas. Esta acción no se puede deshacer.")) return;

        setIsLoading(true);
        try {
            const result = await cleanupAllPayments();
            if (result.success) {
                toast({ title: "Limpieza Completada", description: result.message });
            } else {
                toast({ title: "Error", description: result.message, variant: "destructive" });
            }
        } catch (error) {
            toast({ title: "Error", description: "Ocurrió un error inesperado", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="container mx-auto py-10">
            <Card className="border-destructive">
                <CardHeader>
                    <CardTitle className="text-destructive flex items-center gap-2">
                        <AlertTriangle className="h-6 w-6" />
                        Zona de Peligro: Limpieza de Transacciones (Pagos)
                    </CardTitle>
                    <CardDescription>
                        Utiliza esta herramienta para eliminar TODOS los pagos del sistema.
                        Esto es útil si necesitas reiniciar las cuentas por cobrar.
                        Los saldos de las facturas se recalcularán automáticamente.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button variant="destructive" onClick={handleCleanup} disabled={isLoading} className="w-full sm:w-auto">
                        <DollarSign className="mr-2 h-4 w-4" />
                        {isLoading ? "Limpiando..." : "Eliminar TODOS los Pagos"}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
