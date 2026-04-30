"use client";

import {
  animate,
  useInView,
  useMotionValue,
  useTransform,
  motion,
} from "framer-motion";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type CountUpProps = {
  value: number;
  duration?: number;
  className?: string;
  format?: (n: number) => string;
};

export function CountUp({
  value,
  duration = 1.1,
  className,
  format,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) =>
    format ? format(v) : Math.round(v).toLocaleString()
  );

  useEffect(() => {
    if (!inView) return;
    const controls = animate(mv, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
    });
    return () => controls.stop();
  }, [inView, mv, value, duration]);

  return (
    <motion.span ref={ref} className={cn("tabular-nums", className)}>
      {rounded}
    </motion.span>
  );
}
