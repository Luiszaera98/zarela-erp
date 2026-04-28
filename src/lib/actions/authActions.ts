"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/db";
import { User } from "@/models";
import {
    getSession,
    getSessionCookieOptions,
    mapRoleFromDb,
} from "@/lib/auth/session";

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET?.trim() ||
    process.env.ECF_CERTIFICATE_BASE64?.trim() ||
    process.env.MONGODB_URI?.trim() ||
    process.env.ECF_CERTIFICATE_PASSPHRASE?.trim() ||
    ""
);

const ALG = "HS256";

function hasSessionSecret() {
    return JWT_SECRET.length > 0;
}

function normalizeUsernamePart(value: string) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase();
}

async function ensureUserHasUsername(user: any) {
    if (user.username) return user.username;

    const nameParts = String(user.name || "")
        .trim()
        .split(/\s+/)
        .map(normalizeUsernamePart)
        .filter(Boolean);
    const first = nameParts[0] || String(user.email || "usuario").split("@")[0] || "usuario";
    const last = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";
    const base = last ? `${first}.${last}` : first;

    let candidate = base;
    let suffix = 2;
    while (await User.exists({ username: candidate, _id: { $ne: user._id } })) {
        candidate = `${base}${suffix}`;
        suffix += 1;
    }

    user.username = candidate;
    await user.save();
    return candidate;
}

async function seedUsers() {
    await dbConnect();
    const count = await User.countDocuments();
    if (count === 0) {
        const adminPwd = process.env.ADMIN_PASSWORD?.trim();
        const salesPwd = process.env.SALES_PASSWORD?.trim();
        const inventoryPwd = process.env.INVENTORY_PASSWORD?.trim();

        if (!adminPwd || !salesPwd || !inventoryPwd) {
            console.warn(
                "[AUTH] Se omitió el auto-seed de usuarios porque faltan contraseñas explícitas. La data existente no será tocada."
            );
            return;
        }

        const hashedPasswordAdmin = await bcrypt.hash(adminPwd, 10);
        const hashedPasswordSales = await bcrypt.hash(salesPwd, 10);
        const hashedPasswordInventory = await bcrypt.hash(inventoryPwd, 10);

        await User.create([
            {
                name: "Administrador",
                username: "admin",
                email: "admin@zarelaerp.com",
                password: hashedPasswordAdmin,
                role: "Admin",
                status: "Activo"
            },
            {
                name: "Vendedor",
                username: "vendedor",
                email: "ventas@zarelaerp.com",
                password: hashedPasswordSales,
                role: "Comercial",
                status: "Activo"
            },
            {
                name: "Encargado de Inventario",
                username: "operaciones",
                email: "inventario@zarelaerp.com",
                password: hashedPasswordInventory,
                role: "Operaciones",
                status: "Activo"
            }
        ]);
        console.log("Users seeded successfully");
    }
}

export async function loginAction(formData: FormData) {
    const login = String(formData.get("login") || formData.get("email") || "").trim().toLowerCase();
    const password = formData.get("password") as string;

    if (!login || !password) {
        return { success: false, message: "Usuario y contraseña son requeridos" };
    }

    try {
        if (!hasSessionSecret()) {
            return { success: false, message: "La configuración de sesión no está lista. Defina JWT_SECRET antes del pase." };
        }

        await dbConnect();

        // Auto-seed if empty (Safety mechanism for first run)
        await seedUsers();

        const user = await User.findOne({
            $or: [
                { username: login },
                { email: login }
            ]
        }).select("+password");

        if (!user || !user.password) {
            return { success: false, message: "Credenciales inválidas" };
        }

        const username = await ensureUserHasUsername(user);

        if (user.status !== "Activo") {
            return { success: false, message: "Usuario inactivo. Contacte al administrador." };
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return { success: false, message: "Credenciales inválidas" };
        }

        if (user.mustChangePassword) {
            return {
                success: false,
                requiresPasswordChange: true,
                email: user.email,
                username,
                message: "Debe cambiar la contraseña inicial antes de entrar."
            };
        }

        // Create JWT
        const token = await new SignJWT({
            id: user._id.toString(),
            email: user.email,
            username,
            role: user.role,
            name: user.name
        })
            .setProtectedHeader({ alg: ALG })
            .setIssuedAt()
            .setExpirationTime("7d")
            .sign(JWT_SECRET);

        cookies().set("session", token, getSessionCookieOptions());

        const mappedRole = mapRoleFromDb(user.role);

        return {
            success: true,
            token: token,
            user: {
                id: user._id.toString(),
                email: user.email,
                username,
                name: user.name,
                role: mappedRole
            }
        };

    } catch (error) {
        console.error("Login error:", error);
        return { success: false, message: "Error al iniciar sesión" };
    }
}

function isStrongPassword(password: string) {
    return password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password);
}

export async function changeInitialPasswordAction(formData: FormData) {
    const login = String(formData.get("login") || formData.get("email") || "").trim().toLowerCase();
    const currentPassword = String(formData.get("currentPassword") || "");
    const newPassword = String(formData.get("newPassword") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");

    if (!login || !currentPassword || !newPassword || !confirmPassword) {
        return { success: false, message: "Complete todos los campos." };
    }

    if (newPassword !== confirmPassword) {
        return { success: false, message: "La confirmación no coincide." };
    }

    if (!isStrongPassword(newPassword)) {
        return { success: false, message: "Use al menos 8 caracteres, una mayúscula, una minúscula y un número." };
    }

    if (newPassword === currentPassword) {
        return { success: false, message: "La nueva contraseña debe ser diferente a la contraseña inicial." };
    }

    try {
        await dbConnect();
        const user = await User.findOne({
            $or: [
                { username: login },
                { email: login }
            ]
        }).select("+password");

        if (!user || !user.password) {
            return { success: false, message: "Usuario no encontrado." };
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return { success: false, message: "La contraseña inicial no es correcta." };
        }

        user.password = await bcrypt.hash(newPassword, 10);
        user.mustChangePassword = false;
        await user.save();

        return { success: true, message: "Contraseña actualizada. Ya puede iniciar sesión." };
    } catch (error) {
        console.error("Change initial password error:", error);
        return { success: false, message: "Error al cambiar la contraseña." };
    }
}

export async function logoutAction() {
    cookies().delete("session");
    redirect("/login");
}

export async function isAuthenticated(): Promise<boolean> {
    const session = await getSession();
    return !!session;
}
