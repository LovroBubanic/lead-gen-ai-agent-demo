"use client";

import { motion, useMotionValue, useSpring } from "framer-motion";
import type { MouseEvent, ReactNode } from "react";
import { useRef } from "react";
import { cn } from "@/lib/utils";

type MagnetProps = {
  children: ReactNode;
  className?: string;
  strength?: number;
  as?: "div" | "button" | "span";
};

/**
 * Magnet - React Bits style cursor attraction. Content subtly follows the
 * cursor while hovered.
 */
export function Magnet({
  children,
  className,
  strength = 0.35,
  as = "div",
}: MagnetProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 350, damping: 22, mass: 0.3 });
  const sy = useSpring(y, { stiffness: 350, damping: 22, mass: 0.3 });

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    x.set((e.clientX - cx) * strength);
    y.set((e.clientY - cy) * strength);
  };

  const onLeave = () => {
    x.set(0);
    y.set(0);
  };

  const MotionTag = motion[as] as typeof motion.div;

  return (
    <MotionTag
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ x: sx, y: sy }}
      className={cn("inline-flex", className)}
    >
      {children}
    </MotionTag>
  );
}
