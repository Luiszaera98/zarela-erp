import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/auth/session";

const ROLE_ROUTE_RULES: Array<{
    prefix: string;
    roles: Array<"Administrador" | "Comercial" | "Operaciones">;
}> = [
    { prefix: "/inventory", roles: ["Administrador", "Operaciones"] },
    { prefix: "/invoices", roles: ["Administrador", "Comercial"] },
    { prefix: "/payments", roles: ["Administrador", "Comercial"] },
    { prefix: "/expenses", roles: ["Administrador"] },
    { prefix: "/ecf-logs", roles: ["Administrador"] },
];

export async function middleware(request: NextRequest) {
    const session = request.cookies.get("session");
    const { pathname } = request.nextUrl;

    const isPublicPath =
        pathname === "/login" ||
        pathname.startsWith("/_next") ||
        pathname.startsWith("/api") ||
        pathname.startsWith("/fe") ||
        pathname.includes(".");

    const verifiedSession = session?.value ? await verifySessionToken(session.value) : null;
    const isAuthenticated = !!verifiedSession;

    if (isAuthenticated && pathname === "/login") {
        return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    if (!isAuthenticated && !isPublicPath) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    if (verifiedSession) {
        const matchedRule = ROLE_ROUTE_RULES.find((rule) => pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`));
        if (matchedRule && !matchedRule.roles.includes(verifiedSession.role)) {
            return NextResponse.redirect(new URL("/dashboard", request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
