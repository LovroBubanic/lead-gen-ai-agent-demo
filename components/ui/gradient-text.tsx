"use client";

import { cn } from "@/lib/utils";
import type { ElementType, ReactNode } from "react";

type GradientTextProps = {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  animated?: boolean;
};

export function GradientText({
  as: Tag = "span",
  children,
  className,
  animated = false,
}: GradientTextProps) {
  return (
    <Tag
      className={cn(
        animated ? "gradient-text-animated" : "gradient-text",
        className
      )}
    >
      {children}
    </Tag>
  );
}
