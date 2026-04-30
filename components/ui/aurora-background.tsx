"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type AuroraBackgroundProps = {
  children?: ReactNode;
  className?: string;
  showNoise?: boolean;
  showGrid?: boolean;
};

export function AuroraBackground({
  children,
  className,
  showNoise = true,
  showGrid = false,
}: AuroraBackgroundProps) {
  return (
    <div className="relative isolate overflow-hidden bg-[var(--background)]">
      <div className="aurora-bg" aria-hidden />
      {showGrid ? (
        <div className="pointer-events-none absolute inset-0 dot-grid opacity-40" aria-hidden />
      ) : null}
      {showNoise ? <div className="noise" aria-hidden /> : null}
      <div className={cn("relative z-10 flex min-h-0 w-full flex-col", className)}>
        {children}
      </div>
    </div>
  );
}
