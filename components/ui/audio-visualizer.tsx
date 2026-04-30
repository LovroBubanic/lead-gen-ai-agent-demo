"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type AudioVisualizerProps = {
  stream?: MediaStream | null;
  active?: boolean;
  bars?: number;
  className?: string;
  color?: string;
};

/**
 * AudioVisualizer - renders a live equalizer bar chart from a MediaStream
 * analyser. Falls back to an idle pulse when no stream is attached.
 */
export function AudioVisualizer({
  stream,
  active = true,
  bars = 32,
  className,
  color = "var(--primary)",
}: AudioVisualizerProps) {
  const [levels, setLevels] = useState<number[]>(() =>
    Array.from({ length: bars }, () => 0.12)
  );
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!stream || !active) {
      setLevels((prev) => prev.map(() => 0.1));
      return;
    }
    const AC =
      globalThis.AudioContext ??
      (globalThis as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.72;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(data);
      const step = Math.floor(data.length / bars);
      const next: number[] = [];
      for (let i = 0; i < bars; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) {
          sum += data[i * step + j] || 0;
        }
        const avg = sum / Math.max(1, step) / 255;
        next.push(Math.max(0.08, Math.min(1, Math.pow(avg, 0.75))));
      }
      setLevels(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      source.disconnect();
      analyser.disconnect();
      void ctx.close().catch(() => {});
    };
  }, [stream, active, bars]);

  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center gap-[3px]",
        className
      )}
      aria-hidden
    >
      {levels.map((v, i) => (
        <motion.span
          key={i}
          initial={false}
          animate={{
            height: `${Math.max(8, v * 100)}%`,
            opacity: 0.6 + v * 0.4,
          }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          style={{
            background: color,
            width: 4,
            borderRadius: 999,
            boxShadow: `0 0 8px ${color}`,
          }}
        />
      ))}
    </div>
  );
}
