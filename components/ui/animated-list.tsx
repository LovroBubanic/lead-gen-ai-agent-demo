"use client";

import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type AnimatedListProps<T> = {
  items: T[];
  getKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => ReactNode;
  className?: string;
  itemClassName?: string;
  stagger?: number;
};

export function AnimatedList<T>({
  items,
  getKey,
  renderItem,
  className,
  itemClassName,
  stagger = 0.05,
}: AnimatedListProps<T>) {
  return (
    <ul className={cn("flex flex-col gap-2", className)}>
      <AnimatePresence initial={false}>
        {items.map((item, idx) => (
          <motion.li
            key={getKey(item, idx)}
            layout
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{
              type: "spring",
              stiffness: 380,
              damping: 30,
              delay: idx * stagger,
            }}
            className={itemClassName}
          >
            {renderItem(item, idx)}
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
