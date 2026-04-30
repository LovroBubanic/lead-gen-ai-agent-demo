"use client";

import { useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type ClickSparkProps = {
  children: ReactNode;
  className?: string;
  color?: string;
  count?: number;
  duration?: number;
  disabled?: boolean;
};

/**
 * ClickSpark - React Bits inspired click effect: emits a burst of sparks
 * from wherever the user clicked inside the wrapper.
 */
export function ClickSpark({
  children,
  className,
  color = "#818cf8",
  count = 10,
  duration = 520,
  disabled,
}: ClickSparkProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const spark = useCallback(
    (x: number, y: number) => {
      const host = wrapRef.current;
      if (!host) return;
      const rect = host.getBoundingClientRect();
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
        const distance = 30 + Math.random() * 40;
        const dot = document.createElement("span");
        dot.style.cssText = `
          position: absolute;
          left: ${x - rect.left}px;
          top: ${y - rect.top}px;
          width: 4px;
          height: 4px;
          background: ${color};
          border-radius: 999px;
          pointer-events: none;
          transform: translate(-50%, -50%);
          transition: transform ${duration}ms cubic-bezier(.2,.8,.2,1), opacity ${duration}ms ease-out;
          opacity: 1;
          box-shadow: 0 0 12px ${color};
          z-index: 50;
          will-change: transform, opacity;
        `;
        host.appendChild(dot);
        requestAnimationFrame(() => {
          dot.style.transform = `translate(calc(-50% + ${Math.cos(angle) * distance}px), calc(-50% + ${Math.sin(angle) * distance}px)) scale(0.5)`;
          dot.style.opacity = "0";
        });
        window.setTimeout(() => dot.remove(), duration + 80);
      }
    },
    [color, count, duration]
  );

  const onClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;
      spark(e.clientX, e.clientY);
    },
    [disabled, spark]
  );

  useEffect(() => {
    const host = wrapRef.current;
    if (!host) return;
    return () => {
      host.querySelectorAll("span[data-spark]").forEach((n) => n.remove());
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      onClick={onClick}
      className={cn("relative", className)}
    >
      {children}
    </div>
  );
}
