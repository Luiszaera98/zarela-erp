"use client";

import Image from "next/image";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
    size?: number;
    className?: string;
    priority?: boolean;
}

export function BrandLogo({ size = 40, className, priority }: BrandLogoProps) {
    const { resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const isDark = mounted && resolvedTheme === "dark";
    const src = isDark ? "/zarela-logo-negative.svg" : "/zarela-logo-positive.svg";

    return (
        <Image
            src={src}
            alt="Zarela ERP"
            width={size}
            height={size}
            className={cn("object-contain", className)}
            priority={priority}
        />
    );
}
