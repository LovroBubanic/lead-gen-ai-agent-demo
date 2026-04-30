"use client";

import { cn } from "@/lib/utils";
import type { MouseEvent, ReactNode } from "react";
import { useRef, useState } from "react";

type SpotlightCardProps = {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  spotlightColor?: string;
};

/**
 * SpotlightCard - Card with a soft radial gradient that follows the cursor
 * (React Bits inspired). Falls back gracefully when motion is reduced.
 */
export function SpotlightCard({
  children,
  className,
  innerClassName,
  spotlightColor = "rgba(129, 140, 248, 0.22)",
}: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null
  );
  const [visible, setVisible] = useState(false);

  const onMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      className={cn(
        "group relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)]/80 p-[1px] shadow-[var(--shadow-soft)] backdrop-blur-xl transition-all duration-300 hover:border-[var(--primary)]/40 hover:shadow-[var(--shadow-elevated)]",
        className
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            position && visible
              ? `radial-gradient(480px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 40%)`
              : undefined,
        }}
      />
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
