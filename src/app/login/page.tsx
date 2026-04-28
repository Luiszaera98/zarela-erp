"use client";

import { useFormStatus } from "react-dom";
import { changeInitialPasswordAction, loginAction } from "@/lib/actions/authActions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/brand-logo";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock, LogIn, User } from "lucide-react";
import { useState } from "react";

function SubmitButton() {
    const { pending } = useFormStatus();

    return (
        <Button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 shadow-lg hover:shadow-blue-500/30"
            disabled={pending}
        >
            {pending ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Iniciando sesión...
                </>
            ) : (
                <>
                    <LogIn className="mr-2 h-4 w-4" />
                    Iniciar Sesión
                </>
            )}
        </Button>
    );
}

export default function LoginPage() {
    const { toast } = useToast();
    const [changePasswordLogin, setChangePasswordLogin] = useState('');
    const [initialPassword, setInitialPassword] = useState('');

    async function clientAction(formData: FormData) {
        try {
            const result = await loginAction(formData);

            if (result.success) {
                toast({
                    title: "¡Bienvenido de nuevo!",
                    description: "Has iniciado sesión correctamente.",
                    className: "bg-green-50 border-green-200 text-green-900",
                });

                // Force a hard refresh to ensure the cookie is picked up by the browser middleware
                setTimeout(() => {
                    window.location.assign("/dashboard");
                }, 500);
            } else if (result.requiresPasswordChange) {
                setChangePasswordLogin(result.username || result.email || String(formData.get("login") || formData.get("email") || ""));
                setInitialPassword(String(formData.get("password") || ""));
                toast({
                    title: "Cambio de contraseña requerido",
                    description: result.message,
                });
            } else {
                toast({
                    title: "Error de autenticación",
                    description: result.message || "Credenciales inválidas. Por favor intenta de nuevo.",
                    variant: "destructive",
                });
            }
        } catch (error) {
            console.error("Login client error:", error);
            toast({
                title: "Error de Acción",
                description: "Ocurrió un error inesperado al intentar iniciar sesión.",
                variant: "destructive",
            });
        }
    }

    async function changePasswordClientAction(formData: FormData) {
        const result = await changeInitialPasswordAction(formData);

        if (result.success) {
            toast({
                title: "Contraseña actualizada",
                description: result.message,
                className: "bg-green-50 border-green-200 text-green-900",
            });
            setChangePasswordLogin('');
            setInitialPassword('');
        } else {
            toast({
                title: "No se pudo cambiar la contraseña",
                description: result.message,
                variant: "destructive",
            });
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
            <div className="w-full max-w-md space-y-8 bg-white dark:bg-gray-950 p-10 rounded-2xl shadow-xl">
                <div className="flex flex-col items-center text-center">
                    <div className="mb-6">
                        <BrandLogo size={150} priority className="h-[150px] w-[150px]" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">Bienvenido</h1>
                    <p className="text-sm text-muted-foreground mt-2">
                        Ingresa a Zarela ERP
                    </p>
                </div>

                {changePasswordLogin ? (
                    <form action={changePasswordClientAction} className="space-y-6">
                        <input type="hidden" name="login" value={changePasswordLogin} />
                        <input type="hidden" name="currentPassword" value={initialPassword} />
                        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
                            Esta es una contraseña inicial. Cree una contraseña segura para activar el acceso.
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="newPassword">Nueva contraseña</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                <Input
                                    id="newPassword"
                                    name="newPassword"
                                    type="password"
                                    placeholder="Mínimo 8 caracteres"
                                    required
                                    className="pl-10 h-11 transition-all duration-200 focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                <Input
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    type="password"
                                    placeholder="Repita la contraseña"
                                    required
                                    className="pl-10 h-11 transition-all duration-200 focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                        <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                            Guardar contraseña
                        </Button>
                        <Button type="button" variant="ghost" className="w-full" onClick={() => {
                            setChangePasswordLogin('');
                            setInitialPassword('');
                        }}>
                            Volver al inicio de sesión
                        </Button>
                    </form>
                ) : (
                    <form action={clientAction} className="space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="login">Usuario</Label>
                            <div className="relative">
                                <User className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                <Input
                                    id="login"
                                    name="login"
                                    type="text"
                                    placeholder="Usuario"
                                    required
                                    autoCapitalize="none"
                                    autoComplete="username"
                                    className="pl-10 h-11 transition-all duration-200 focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password">Contraseña</Label>
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                <Input
                                    id="password"
                                    name="password"
                                    type="password"
                                    placeholder="••••••••"
                                    required
                                    className="pl-10 h-11 transition-all duration-200 focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                    </div>

                    <SubmitButton />
                    </form>
                )}

                <div className="text-center text-sm">
                    <p className="text-muted-foreground">
                        ¿Olvidaste tu contraseña? <span className="text-blue-600 cursor-pointer hover:underline font-medium">Contactar Soporte</span>
                    </p>
                </div>
            </div>
        </div>
    );
}
