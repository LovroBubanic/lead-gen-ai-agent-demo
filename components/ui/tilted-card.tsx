"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import type { MouseEvent, ReactNode } from "react";
import { useRef } from "react";
import { cn } from "@/lib/utils";

type TiltedCardProps = {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  max?: number;
};

/**
 * TiltedCard - React Bits inspired 3D tilt that reacts to the cursor.
 */
export function TiltedCard({
  children,
  className,
  innerClassName,
  max = 10,
}: TiltedCardProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const rotateX = useSpring(rx, { stiffness: 220, damping: 18 });
  const rotateY = useSpring(ry, { stiffness: 220, damping: 18 });
  const glareX = useTransform(ry, (v) => `${50 + v * 2}%`);
  const glareY = useTransform(rx, (v) => `${50 - v * 2}%`);

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    rx.set(-py * max);
    ry.set(px * max);
  };
  const onLeave = () => {
    rx.set(0);
    ry.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
        perspective: 1000,
      }}
      className={cn(
        "relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)]",
        className
      )}
    >
      <div className={cn("relative z-10", innerClassName)}>{children}</div>
      <motion.div
        aria-hidden
        style={{
          background: `radial-gradient(500px circle at ${glareX.get()} ${glareY.get()}, rgba(255,255,255,0.18), transparent 50%)`,
        }}
        className="pointer-events-none absolute inset-0"
      />
    </motion.div>
  );
}
