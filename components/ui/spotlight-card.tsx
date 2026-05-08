import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type SpotlightCardProps = {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
};

export function SpotlightCard({
  children,
  className,
  innerClassName,
}: SpotlightCardProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)]/80 p-[1px] shadow-[var(--shadow-soft)] transition-all duration-300 hover:border-[var(--primary)]/40 hover:shadow-[var(--shadow-elevated)]",
        className
      )}
    >
      <div
        className={cn(
          "relative rounded-[inherit] bg-[var(--surface)]/95",
          innerClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}
