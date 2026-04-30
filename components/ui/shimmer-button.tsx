"use client";

import { motion } from "framer-motion";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ShimmerButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  tone?: "brand" | "success" | "danger" | "neutral";
  shine?: boolean;
};

const toneClass: Record<NonNullable<ShimmerButtonProps["tone"]>, string> = {
  brand:
    "bg-[linear-gradient(120deg,#6366f1_0%,#8b5cf6_55%,#ec4899_100%)] text-white shadow-[0_18px_50px_-18px_rgba(99,102,241,0.6)] hover:shadow-[0_25px_60px_-18px_rgba(99,102,241,0.8)]",
  success:
    "bg-[linear-gradient(120deg,#10b981_0%,#22d3ee_100%)] text-white shadow-[0_18px_50px_-18px_rgba(16,185,129,0.55)]",
  danger:
    "bg-[linear-gradient(120deg,#ef4444_0%,#f97316_100%)] text-white shadow-[0_18px_50px_-18px_rgba(239,68,68,0.55)]",
  neutral:
    "bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] shadow-[var(--shadow-soft)] hover:border-[var(--primary)]/40",
};

export function ShimmerButton({
  children,
  className,
  tone = "brand",
  shine = true,
  disabled,
  ...rest
}: ShimmerButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: disabled ? 1 : 0.96 }}
      whileHover={disabled ? undefined : { y: -1 }}
      disabled={disabled}
      className={cn(
        "relative inline-flex select-none items-center justify-center gap-2 overflow-hidden rounded-full px-5 py-2.5 text-sm font-semibold tracking-tight transition-all duration-200 focus-ring disabled:cursor-not-allowed disabled:opacity-60",
        toneClass[tone],
        className
      )}
      {...(rest as React.ComponentProps<typeof motion.button>)}
    >
      {shine ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-full"
        >
          <span className="absolute -inset-y-2 -left-1/2 w-1/3 rotate-12 bg-gradient-to-r from-transparent via-white/40 to-transparent blur-sm [animation:shimmer-sweep_2.8s_ease-in-out_infinite]" />
        </span>
      ) : null}
      <span className="relative z-10 inline-flex items-center gap-2">
        {children}
      </span>
      <style jsx>{`
        @keyframes shimmer-sweep {
          0% {
            transform: translateX(-140%) rotate(12deg);
          }
          60%,
          100% {
            transform: translateX(380%) rotate(12deg);
          }
        }
      `}</style>
    </motion.button>
  );
}
