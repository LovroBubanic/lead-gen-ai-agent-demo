"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type ShinyTextProps = {
  children: ReactNode;
  className?: string;
};

/**
 * ShinyText - React Bits style shimmer sweep across text.
 * Uses the `.shine-text` utility defined in globals.css.
 */
export function ShinyText({ children, className }: ShinyTextProps) {
  return <span className={cn("shine-text", className)}>{children}</span>;
}
