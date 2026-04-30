"use client";

import { cn } from "@/lib/utils";
import type { MouseEvent, ReactNode } from "react";
import { useRef, useState } from "react";

type GlareHoverProps = {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
};

/**
 * GlareHover - React Bits inspired glare that sweeps across the card on
 * hover, tracking the cursor.
 */
export function GlareHover({
  children,
  className,
  innerClassName,
}: GlareHoverProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [p, setP] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [hover, setHover] = useState(false);

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setP({
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
    });
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={cn(
        "relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)]",
        className
      )}
    >
      <div className={cn("relative z-[1]", innerClassName)}>{children}</div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: hover ? 1 : 0,
          background: `radial-gradient(600px circle at ${p.x}% ${p.y}%, rgba(255,255,255,0.12), transparent 45%)`,
        }}
      />
    </div>
  );
}
