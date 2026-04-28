import { jwtVerify, type JWTPayload } from "jose";

export type DbUserRole = "Admin" | "Comercial" | "Operaciones" | "Vendedor" | "Almacén" | "Gerente";
export type AppUserRole = "Administrador" | "Comercial" | "Operaciones" | "Gerente";

export type UserSession = {
    id: string;
    email?: string;
    username?: string;
    name: string;
    role: AppUserRole;
};

type SessionPayload = JWTPayload & {
    id?: string;
    email?: string;
    username?: string;
    name?: string;
    role?: string;
};

let warnedAboutDerivedSecret = false;

export function mapRoleToDb(role: string): DbUserRole {
    switch (role) {
        case "Administrador":
        case "Admin":
            return "Admin";
        case "Comercial":
        case "Ventas":
        case "Vendedor":
            return "Comercial";
        case "Operaciones":
        case "Inventario":
        case "Almacén":
            return "Operaciones";
        case "Gerente":
        case "Supervisor":
            return "Gerente";
        default:
            return "Comercial";
    }
}

export function mapRoleFromDb(role: string): AppUserRole {
    switch (role) {
        case "Admin":
        case "Administrador":
            return "Administrador";
        case "Comercial":
        case "Vendedor":
        case "Ventas":
            return "Comercial";
        case "Operaciones":
        case "Almacén":
        case "Inventario":
            return "Operaciones";
        case "Gerente":
        case "Supervisor":
            return "Gerente";
        default:
            return "Comercial";
    }
}

function normalizeAppRole(role: string): AppUserRole {
    return mapRoleFromDb(role);
}

function getJwtSecretValue(): string {
    const explicitSecret = process.env.JWT_SECRET?.trim();
    if (explicitSecret) {
        return explicitSecret;
    }

    const derivedSecret =
        process.env.ECF_CERTIFICATE_BASE64?.trim() ||
        process.env.MONGODB_URI?.trim() ||
        process.env.ECF_CERTIFICATE_PASSPHRASE?.trim();

    if (!derivedSecret) {
        throw new Error(
            "No se pudo resolver el secreto de sesión. Configure JWT_SECRET para entornos nuevos."
        );
    }

    if (!warnedAboutDerivedSecret) {
        warnedAboutDerivedSecret = true;
        console.warn(
            "[AUTH] JWT_SECRET no está configurado. Se usará un secreto derivado para compatibilidad; configure JWT_SECRET antes del pase a producción."
        );
    }

    return derivedSecret;
}

function getJwtSecret(): Uint8Array {
    return new TextEncoder().encode(getJwtSecretValue());
}

export function getSessionCookieOptions() {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    const shouldUseSecureCookie =
        process.env.NODE_ENV === "production" || appUrl.startsWith("https://");

    return {
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
        sameSite: "lax" as const,
        secure: shouldUseSecureCookie,
    };
}

export async function verifySessionToken(token: string): Promise<UserSession | null> {
    try {
        const { payload } = await jwtVerify(token, getJwtSecret());
        const typedPayload = payload as SessionPayload;

        if (!typedPayload.id || !typedPayload.name || !typedPayload.role || (!typedPayload.username && !typedPayload.email)) {
            return null;
        }

        return {
            id: typedPayload.id,
            email: typedPayload.email,
            username: typedPayload.username,
            name: typedPayload.name,
            role: mapRoleFromDb(typedPayload.role),
        };
    } catch {
        return null;
    }
}

export async function getSession(): Promise<UserSession | null> {
    const { cookies } = await import("next/headers");
    const sessionCookie = cookies().get("session");
    if (!sessionCookie?.value) {
        return null;
    }

    return verifySessionToken(sessionCookie.value);
}

export async function requireSession(): Promise<UserSession> {
    const session = await getSession();
    if (!session) {
        throw new Error("UNAUTHORIZED");
    }

    return session;
}

export async function requireRole(roles: string[]): Promise<UserSession> {
    const session = await requireSession();
    const allowedRoles = roles.map(normalizeAppRole);

    // Gerente automatically inherits Comercial and Operaciones actions
    if (session.role === 'Gerente') {
        if (allowedRoles.includes('Comercial') || allowedRoles.includes('Operaciones')) {
            return session;
        }
    }

    if (!allowedRoles.includes(session.role)) {
        throw new Error("FORBIDDEN");
    }

    return session;
}

export function getAuthErrorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "UNAUTHORIZED") {
        return "Debe iniciar sesión para realizar esta acción.";
    }

    if (message === "FORBIDDEN") {
        return "No tiene permisos para realizar esta acción.";
    }

    return message;
}
