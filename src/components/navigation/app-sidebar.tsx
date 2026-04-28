
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import {
    Sidebar,
    SidebarHeader,
    SidebarContent,
    SidebarFooter,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
} from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    LayoutDashboard,
    UsersRound,
    Boxes,
    Wrench,
    FileText,
    ClipboardList,
    Receipt,
    Settings2,
    type LucideIcon,
    History,
    LogOut,
    User,
    Sun,
    Moon,
    Laptop,
    Activity,
} from "lucide-react";
import React from "react";
import type { UserRole } from "@/types";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/lib/actions/authActions";
import { useTheme } from "next-themes";

interface NavItem {
    href: string;
    label: string;
    icon?: LucideIcon;
    roles?: UserRole[];
    exactMatch?: boolean;
}

interface NavSection {
    label: string;
    items: NavItem[];
}

const navSections: NavSection[] = [
    {
        label: "Panel",
        items: [
            { href: "/dashboard", label: "Panel Principal", icon: LayoutDashboard, roles: ['Administrador', 'Comercial', 'Operaciones', 'Gerente'] },
        ],
    },
    {
        label: "Operaciones",
        items: [
            { href: "/clients", label: "Contactos", icon: UsersRound, roles: ['Administrador', 'Comercial', 'Operaciones', 'Gerente'] },
            { href: "/quotations", label: "Cotizaciones", icon: ClipboardList, roles: ['Administrador', 'Comercial', 'Gerente'] },
            { href: "/invoices", label: "Facturas", icon: FileText, roles: ['Administrador', 'Comercial', 'Gerente'] },
            { href: "/payments", label: "Transacciones", icon: History, roles: ['Administrador', 'Comercial', 'Gerente'] },
        ],
    },
    {
        label: "Catálogo",
        items: [
            { href: "/inventory", label: "Inventario", icon: Boxes, roles: ['Administrador', 'Operaciones', 'Gerente'] },
            { href: "/services", label: "Servicios", icon: Wrench, roles: ['Administrador', 'Comercial', 'Gerente'] },
        ],
    },
    {
        label: "Administración",
        items: [
            { href: "/expenses", label: "Gastos", icon: Receipt, roles: ['Administrador', 'Gerente'] },
            { href: "/ecf-logs", label: "Monitor e-CF", icon: Activity, roles: ['Administrador'] },
            { href: "/settings", label: "Configuración", icon: Settings2, roles: ['Administrador', 'Comercial', 'Operaciones', 'Gerente'] },
        ],
    },
];

interface AppSidebarProps {
    currentUserRole?: UserRole;
    userName?: string;
    userEmail?: string;
}

export function AppSidebar({ currentUserRole, userName, userEmail }: AppSidebarProps) {
    const pathname = usePathname();
    const { setTheme } = useTheme();

    const filteredNavSections = navSections
        .map(section => ({
            ...section,
            items: section.items.filter(item => !currentUserRole || !item.roles || item.roles.includes(currentUserRole)),
        }))
        .filter(section => section.items.length > 0);

    const isNavItemActive = (item: NavItem): boolean => {
        if (item.exactMatch) return pathname === item.href;

        if (item.href === "/dashboard") return pathname === item.href;
        if (item.href === "/clients" && pathname === "/clients") return true;
        if (item.href === "/inventory" && pathname === "/inventory") return true;
        if (item.href === "/services" && pathname === "/services") return true;
        if (item.href === "/quotations" && pathname === "/quotations") return true;
        if (item.href === "/invoices" && pathname === "/invoices") return true;
        if (item.href === "/payments" && pathname === "/payments") return true;
        if (item.href === "/expenses" && pathname === "/expenses") return true;
        if (item.href === "/ecf-logs" && pathname === "/ecf-logs") return true;
        if (item.href === "/settings" && pathname === "/settings") return true;

        return pathname.startsWith(item.href) && item.href !== '/';
    };

    if (!currentUserRole) {
        return null;
    }

    return (
        <Sidebar collapsible="icon" variant="sidebar" className="border-r border-sidebar-border bg-sidebar/95 backdrop-blur supports-[backdrop-filter]:bg-sidebar/60">
            <SidebarHeader className="p-0 border-b border-sidebar-border">
                <Link href="/dashboard" className="flex items-center h-20 px-4 transition-colors hover:bg-sidebar-accent/50">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-sidebar-accent/50 p-1 shadow-sm group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:h-10">
                        <BrandLogo size={32} className="w-full h-full" />
                    </div>
                    <div className="ml-3 flex flex-col group-data-[collapsible=icon]:hidden">
                        <span className="text-sm font-bold text-sidebar-foreground leading-tight">
                            Zarela ERP
                        </span>
                        <span className="text-[10px] text-muted-foreground mt-0.5 font-medium uppercase tracking-wide">
                            ERP Comercial
                        </span>
                    </div>
                </Link>
            </SidebarHeader>
            <SidebarContent className="flex-1 p-2">
                <ScrollArea className="h-full">
                    <div className="space-y-5">
                        {filteredNavSections.map((section) => (
                            <div key={section.label} className="space-y-1">
                                <div className="px-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground group-data-[collapsible=icon]:hidden">
                                    {section.label}
                                </div>
                                <SidebarMenu className="space-y-1">
                                    {section.items.map((item) => (
                                        <SidebarMenuItem key={item.label}>
                                            <Link href={item.href} passHref legacyBehavior>
                                                <SidebarMenuButton
                                                    isActive={isNavItemActive(item)}
                                                    tooltip={item.label}
                                                    className="font-medium"
                                                >
                                                    {item.icon && <item.icon className="h-4 w-4 opacity-70" />}
                                                    <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                                                </SidebarMenuButton>
                                            </Link>
                                        </SidebarMenuItem>
                                    ))}
                                </SidebarMenu>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </SidebarContent>
            <SidebarFooter className="p-4 border-t border-sidebar-border mt-auto">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="flex items-center gap-3 w-full hover:bg-sidebar-accent/50 p-2 rounded-md transition-colors group-data-[collapsible=icon]:justify-center">
                            <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center border border-border shadow-sm">
                                <User className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div className="flex flex-col group-data-[collapsible=icon]:hidden text-left flex-1">
                                <span className="text-sm font-medium text-sidebar-foreground">{userName || 'Usuario'}</span>
                                <span className="text-xs text-muted-foreground">{userEmail || currentUserRole}</span>
                            </div>
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => logoutAction()} className="text-destructive focus:text-destructive cursor-pointer">
                            <LogOut className="h-4 w-4 mr-2" />
                            Cerrar Sesión
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Tema</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => setTheme("light")} className="cursor-pointer">
                            <Sun className="h-4 w-4 mr-2" />
                            Claro
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTheme("dark")} className="cursor-pointer">
                            <Moon className="h-4 w-4 mr-2" />
                            Oscuro
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTheme("system")} className="cursor-pointer">
                            <Laptop className="h-4 w-4 mr-2" />
                            Sistema
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarFooter>
        </Sidebar>
    );
}
