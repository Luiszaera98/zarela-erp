"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LogOut, Menu, PlusCircle, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { navSections } from "@/components/navigation/app-sidebar";
import type { UserRole } from "@/types";
import { cn } from "@/lib/utils";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BrandLogo } from "@/components/brand-logo";
import { logoutAction } from "@/lib/actions/authActions";

interface MobileBottomNavProps {
    currentUserRole?: UserRole;
}

const preferredItems = ["/dashboard", "/clients", "/quotations", "/invoices"];

export function MobileBottomNav({ currentUserRole }: MobileBottomNavProps) {
    const pathname = usePathname();

    if (!currentUserRole) return null;

    const canAccessItem = (item: (typeof navSections)[number]["items"][number]) =>
        !item.roles ||
        item.roles.includes(currentUserRole) ||
        (currentUserRole === "Comercial" && item.href === "/inventory");

    const availableItems = navSections
        .flatMap(section => section.items)
        .filter(canAccessItem);

    const primaryItems = preferredItems
        .map(href => availableItems.find(item => item.href === href))
        .filter(Boolean)
        .slice(0, 4);

    const shortLabels: Record<string, string> = {
        "/dashboard": "Panel",
        "/clients": "Contactos",
        "/quotations": "Cotizar",
        "/invoices": "Facturas",
    };

    if (primaryItems.length === 0) {
        primaryItems.push({
            href: "/dashboard",
            label: "Panel",
            icon: LayoutDashboard,
            roles: [currentUserRole],
        });
    }

    return (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
            <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
                {primaryItems.map((item) => {
                    const Icon = item?.icon || PlusCircle;
                    const active = pathname === item?.href || pathname.startsWith(`${item?.href}/`);

                    return (
                        <Link
                            key={item?.href}
                            href={item?.href || "/dashboard"}
                            className={cn(
                                "flex min-h-12 flex-col items-center justify-center gap-1 rounded-md px-1 text-[11px] font-medium text-muted-foreground",
                                active && "bg-primary text-primary-foreground"
                            )}
                        >
                            <Icon className="h-5 w-5" />
                            <span className="max-w-full truncate">{shortLabels[item?.href || ""] || item?.label}</span>
                        </Link>
                    );
                })}
                <Sheet>
                    <SheetTrigger asChild>
                        <Button
                            type="button"
                            variant="ghost"
                            className="flex h-auto min-h-12 flex-col items-center justify-center gap-1 rounded-md px-1 text-[11px] font-medium text-muted-foreground"
                        >
                            <Menu className="h-5 w-5" />
                            <span>Más</span>
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="max-h-[86svh] overflow-y-auto rounded-t-lg px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-4">
                        <SheetHeader className="text-left">
                            <SheetTitle className="flex items-center gap-3">
                                <span className="flex h-10 w-10 items-center justify-center rounded-md border bg-muted p-1">
                                    <BrandLogo size={28} />
                                </span>
                                <span>
                                    <span className="block text-base font-semibold">Zarela ERP</span>
                                    <span className="block text-xs font-medium uppercase text-muted-foreground">Menú</span>
                                </span>
                            </SheetTitle>
                            <SheetDescription className="sr-only">
                                Navegación principal de Zarela ERP para teléfonos.
                            </SheetDescription>
                        </SheetHeader>
                        <div className="mt-5 space-y-5">
                            {navSections.map(section => {
                                const items = section.items.filter(canAccessItem);
                                if (items.length === 0) return null;

                                return (
                                    <div key={section.label} className="space-y-2">
                                        <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{section.label}</div>
                                        <div className="grid grid-cols-2 gap-2">
                                            {items.map(item => {
                                                const Icon = item.icon || User;
                                                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                                                return (
                                                    <SheetClose asChild key={item.href}>
                                                        <Link
                                                            href={item.href}
                                                            className={cn(
                                                                "flex min-h-14 items-center gap-3 rounded-md border px-3 text-sm font-medium",
                                                                active ? "border-primary bg-primary text-primary-foreground" : "bg-background"
                                                            )}
                                                        >
                                                            <Icon className="h-5 w-5 shrink-0" />
                                                            <span className="truncate">{item.label}</span>
                                                        </Link>
                                                    </SheetClose>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                            <Button variant="outline" className="w-full justify-start gap-3 text-destructive" onClick={() => logoutAction()}>
                                <LogOut className="h-5 w-5" />
                                Cerrar sesión
                            </Button>
                        </div>
                    </SheetContent>
                </Sheet>
            </div>
        </nav>
    );
}
