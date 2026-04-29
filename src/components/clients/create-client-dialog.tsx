"use client";

import React, { useState, useTransition } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle } from 'lucide-react';
import { createClient } from '@/lib/actions/clientActions';
import { useToast } from '@/hooks/use-toast';
import { ContactType } from '@/types';

interface CreateClientDialogProps {
    onClientCreated?: () => void;
}

export function CreateClientDialog({ onClientCreated }: CreateClientDialogProps) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    // Form state
    const [name, setName] = useState('');
    const [contactType, setContactType] = useState<ContactType>('Cliente');
    const [rncCedula, setRncCedula] = useState('');
    const [email, setEmail] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [address, setAddress] = useState('');

    const resetForm = () => {
        setName('');
        setContactType('Cliente');
        setRncCedula('');
        setEmail('');
        setPhoneNumber('');
        setAddress('');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!name || !rncCedula) {
            toast({
                title: "Error de validación",
                description: "Por favor complete todos los campos requeridos.",
                variant: "destructive",
            });
            return;
        }

        startTransition(async () => {
            const result = await createClient({
                name,
                contactType,
                rncCedula,
                email,
                phoneNumber,
                address,
            });

            if (result.success) {
                toast({
                    title: "Contacto creado",
                    description: `El contacto ${name} ha sido creado exitosamente.`,
                });
                setOpen(false);
                resetForm();
                if (onClientCreated) {
                    onClientCreated();
                }
            } else {
                toast({
                    title: "Error",
                    description: result.message || "No se pudo crear el contacto.",
                    variant: "destructive",
                });
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="w-full bg-primary text-primary-foreground shadow-lg transition-all duration-300 hover:bg-primary/90 hover:shadow-xl sm:w-auto">
                    <PlusCircle className="mr-2 h-5 w-5" /> Nuevo Contacto
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Crear Nuevo Contacto</DialogTitle>
                    <DialogDescription>
                        Añada un nuevo cliente, proveedor o empleado al sistema.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nombre / Razón Social *</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Ej. Empresa ABC"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="contactType">Tipo de Contacto *</Label>
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
                        <Label htmlFor="rncCedula">RNC / Cédula *</Label>
                        <Input
                            id="rncCedula"
                            value={rncCedula}
                            onChange={(e) => setRncCedula(e.target.value)}
                            placeholder="Ej. 101-12345-6"
                            required
                        />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="email">Correo Electrónico</Label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="contacto@ejemplo.com"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phoneNumber">Teléfono</Label>
                            <Input
                                id="phoneNumber"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                placeholder="809-555-1234"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="address">Dirección</Label>
                        <Input
                            id="address"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="Calle Principal #123, Ciudad"
                        />
                    </div>

                    <DialogFooter className="gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending} className="w-full sm:w-auto">
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
                            {isPending ? "Guardando..." : "Guardar Contacto"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
