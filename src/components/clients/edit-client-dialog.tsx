"use client";

import React, { useState, useTransition, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { updateClient } from '@/lib/actions/clientActions';
import { useToast } from '@/hooks/use-toast';
import { Client, ContactType } from '@/types';

interface EditClientDialogProps {
    client: Client | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onClientUpdated: () => void;
}

export function EditClientDialog({ client, open, onOpenChange, onClientUpdated }: EditClientDialogProps) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    // Form state
    const [name, setName] = useState('');
    const [contactType, setContactType] = useState<ContactType>('Cliente');
    const [rncCedula, setRncCedula] = useState('');
    const [email, setEmail] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [address, setAddress] = useState('');

    useEffect(() => {
        if (client && open) {
            setName(client.name);
            setContactType(client.contactType || (client.contactType === 'Cliente' ? 'Cliente' : 'Empresa') as any); // Fallback logic if needed
            setRncCedula(client.rncCedula || '');
            setEmail(client.email || '');
            setPhoneNumber(client.phoneNumber || '');
            setAddress(client.address || '');
        }
    }, [client, open]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!client) return;

        if (!name || !rncCedula) {
            toast({
                title: "Error de validación",
                description: "Por favor complete todos los campos requeridos.",
                variant: "destructive",
            });
            return;
        }

        startTransition(async () => {
            const result = await updateClient(client.id, {
                name,
                contactType,
                rncCedula,
                email,
                phoneNumber,
                address,
            });

            if (result.success) {
                toast({
                    title: "Contacto actualizado",
                    description: `El contacto ${name} ha sido actualizado exitosamente.`,
                });
                onOpenChange(false);
                onClientUpdated();
            } else {
                toast({
                    title: "Error",
                    description: result.message || "No se pudo actualizar el contacto.",
                    variant: "destructive",
                });
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Editar Contacto</DialogTitle>
                    <DialogDescription>
                        Modifique los datos del contacto.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-name">Nombre / Razón Social *</Label>
                            <Input
                                id="edit-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Ej. Empresa ABC"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-contactType">Tipo de Contacto *</Label>
                            <Select value={contactType} onValueChange={(val) => setContactType(val as ContactType)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccione tipo" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Cliente">Cliente</SelectItem>
                                    <SelectItem value="Proveedor">Proveedor</SelectItem>
                                    <SelectItem value="Empleado">Empleado</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-rncCedula">RNC / Cédula *</Label>
                        <Input
                            id="edit-rncCedula"
                            value={rncCedula}
                            onChange={(e) => setRncCedula(e.target.value)}
                            placeholder="Ej. 101-12345-6"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-email">Correo Electrónico</Label>
                            <Input
                                id="edit-email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="contacto@ejemplo.com"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-phoneNumber">Teléfono</Label>
                            <Input
                                id="edit-phoneNumber"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                placeholder="809-555-1234"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-address">Dirección</Label>
                        <Input
                            id="edit-address"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="Calle Principal #123, Ciudad"
                        />
                    </div>

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending ? "Guardando..." : "Guardar Cambios"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
