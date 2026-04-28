import { Suspense } from "react";
import { AppSidebar } from "@/components/navigation/app-sidebar";
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
            <SidebarInset>
                <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 justify-between">
                    <div className="flex items-center gap-2">
                        <SidebarTrigger className="-ml-1" />
                        <div className="h-4 w-[1px] bg-gray-200" />
                    </div>
                    <ModeToggle />
                </header>
                <main className="flex-1 p-4">
                    {children}
                </main>
            </SidebarInset>
        </SidebarProvider>
    );
}
