"use client";

import { motion } from "framer-motion";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ShimmerButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  tone?: "brand" | "success" | "danger" | "neutral";
};

const toneClass: Record<NonNullable<ShimmerButtonProps["tone"]>, string> = {
  brand:
    "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[var(--shadow-soft)] hover:bg-[var(--primary-hover)]",
  success:
    "bg-emerald-700 text-white shadow-[var(--shadow-soft)] hover:bg-emerald-800",
  danger:
    "bg-red-600 text-white shadow-[var(--shadow-soft)] hover:bg-red-700",
  neutral:
    "bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] shadow-[var(--shadow-soft)] hover:border-[var(--primary)]/40",
};

export function ShimmerButton({
  children,
  className,
  tone = "brand",
  disabled,
  ...rest
}: ShimmerButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: disabled ? 1 : 0.96 }}
      whileHover={disabled ? undefined : { y: -1 }}
      disabled={disabled}
      className={cn(
        "relative inline-flex select-none items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold tracking-tight transition-all duration-200 focus-ring disabled:cursor-not-allowed disabled:opacity-60",
        toneClass[tone],
        className
      )}
      {...(rest as React.ComponentProps<typeof motion.button>)}
    >
      <span className="inline-flex items-center gap-2">{children}</span>
    </motion.button>
  );
}
