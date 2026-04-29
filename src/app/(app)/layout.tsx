import { Suspense } from "react";
import { AppSidebar } from "@/components/navigation/app-sidebar";
import { MobileBottomNav } from "@/components/navigation/mobile-bottom-nav";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { ModeToggle } from "@/components/mode-toggle";
import { getSession } from "@/lib/auth/session";

export default async function AppLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const session = await getSession();

    return (
        <SidebarProvider>
            <Suspense>
                <AppSidebar
                    currentUserRole={session?.role}
                    userName={session?.name}
                    userEmail={session?.email}
                />
            </Suspense>
            <SidebarInset className="min-w-0">
                <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur md:h-16 md:px-4 justify-between">
                    <div className="flex items-center gap-2">
                        <SidebarTrigger className="-ml-1 hidden md:inline-flex" />
                        <div className="hidden h-4 w-[1px] bg-gray-200 md:block" />
                    </div>
                    <ModeToggle />
                </header>
                <main className="min-w-0 flex-1 px-3 pb-24 pt-4 md:p-4">
                    {children}
                </main>
                <MobileBottomNav currentUserRole={session?.role} />
            </SidebarInset>
        </SidebarProvider>
    );
}
