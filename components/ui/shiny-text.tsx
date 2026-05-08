"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type ShinyTextProps = {
  children: ReactNode;
  className?: string;
};

export function ShinyText({ children, className }: ShinyTextProps) {
  return (
    <span className={cn("text-[var(--foreground)]", className)}>{children}</span>
  );
}
