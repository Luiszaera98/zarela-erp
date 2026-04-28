"use client";

import React, { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Copy, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { createUser, deleteUser } from '@/lib/actions/settingsActions';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface User {
    id: string;
    name: string;
    username: string;
    email?: string;
    role: string;
    status: string;
    mustChangePassword?: boolean;
    createdAt: string;
}

interface UsersSettingsProps {
    initialUsers: User[];
}

export function UsersSettings({ initialUsers }: UsersSettingsProps) {
    const [users, setUsers] = useState<User[]>(initialUsers);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // Form State
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('Comercial');
    const [generatedCredentials, setGeneratedCredentials] = useState<{ name: string; username: string; password: string } | null>(null);

    const roleOptions = [
        {
            value: 'Administrador',
            label: 'Administrador',
            description: 'Acceso total: configuración, usuarios, finanzas, DGII y todos los módulos.',
        },
        {
            value: 'Comercial',
            label: 'Comercial',
            description: 'Ventas del día a día: contactos, servicios, cotizaciones, facturas, cobros y e-CF de ventas.',
        },
        {
            value: 'Operaciones',
            label: 'Operaciones',
            description: 'Ejecución operativa: contactos, inventario, entradas, salidas, ajustes y consulta de catálogo.',
        },
    ];

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        startTransition(async () => {
            const result = await createUser({ name, email, role });
            if (result.success) {
                setGeneratedCredentials({ name, username: result.username || '', password: result.initialPassword || '' });
                toast({ title: "Usuario creado", description: `Usuario y clave inicial generados para ${name}.` });
                setName('');
                setEmail('');
                setRole('Comercial');
            } else {
                toast({ title: "Error", description: result.message, variant: "destructive" });
            }
        });
    };

    const closeCreateDialog = (open: boolean) => {
        setIsDialogOpen(open);
        if (!open && generatedCredentials) {
            window.location.reload();
        }
        if (!open) {
            setGeneratedCredentials(null);
        }
    };

    const handleDelete = (id: string, userName: string) => {
        if (!confirm(`¿Está seguro de eliminar al usuario ${userName}?`)) return;

        startTransition(async () => {
            const result = await deleteUser(id);
            if (result.success) {
                setUsers(users.filter(u => u.id !== id));
                toast({ title: "Usuario eliminado", description: "El usuario ha sido eliminado correctamente." });
            } else {
                toast({ title: "Error", description: result.message, variant: "destructive" });
            }
        });
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Gestión de Usuarios</CardTitle>
                    <CardDescription>Administre los usuarios que tienen acceso al sistema.</CardDescription>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={closeCreateDialog}>
                    <DialogTrigger asChild>
                        <Button>
                            <UserPlus className="h-4 w-4 mr-2" /> Nuevo Usuario
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Crear Nuevo Usuario</DialogTitle>
                            <DialogDescription>
                                Asigne un rol operativo. El sistema generará una clave inicial y pedirá cambiarla en el primer acceso.
                            </DialogDescription>
                        </DialogHeader>
                        {generatedCredentials ? (
                            <div className="space-y-4 py-4">
                                <div className="rounded-md border bg-muted/40 p-4">
                                    <div className="flex items-start gap-3">
                                        <ShieldCheck className="mt-0.5 h-5 w-5 text-green-600" />
                                        <div className="space-y-1">
                                            <p className="font-medium">Usuario creado: {generatedCredentials.name}</p>
                                            <p className="text-sm text-muted-foreground">
                                                Entregue este usuario y clave inicial. Al iniciar sesión deberá cambiarla por una contraseña segura.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Usuario</Label>
                                    <div className="flex gap-2">
                                        <Input value={generatedCredentials.username} readOnly className="font-mono" />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={() => navigator.clipboard.writeText(generatedCredentials.username)}
                                        >
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Clave inicial</Label>
                                    <div className="flex gap-2">
                                        <Input value={generatedCredentials.password} readOnly className="font-mono" />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={() => navigator.clipboard.writeText(generatedCredentials.password)}
                                        >
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button type="button" onClick={() => closeCreateDialog(false)}>
                                        Entendido
                                    </Button>
                                </DialogFooter>
                            </div>
                        ) : (
                            <form onSubmit={handleCreate} className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Nombre Completo</Label>
                                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">Correo Electrónico</Label>
                                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Opcional" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="role">Rol</Label>
                                    <Select value={role} onValueChange={setRole}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {roleOptions.map(option => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        {roleOptions.find(option => option.value === role)?.description}
                                    </p>
                                </div>
                                <DialogFooter>
                                    <Button type="submit" disabled={isPending}>
                                        {isPending ? "Creando..." : "Crear Usuario"}
                                    </Button>
                                </DialogFooter>
                            </form>
                        )}
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <div className="border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Usuario</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Rol</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell className="font-medium">{user.name}</TableCell>
                                    <TableCell className="font-mono text-sm">{user.username}</TableCell>
                                    <TableCell>{user.email || 'N/A'}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                            <Badge variant="outline" className="w-fit">{user.role}</Badge>
                                            {user.mustChangePassword && (
                                                <span className="text-xs text-muted-foreground">Debe cambiar clave</span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={user.status === 'Activo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                                            {user.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDelete(user.id, user.name)}
                                            disabled={isPending}
                                            className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {users.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center text-muted-foreground h-24">
                                        No hay usuarios registrados.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
