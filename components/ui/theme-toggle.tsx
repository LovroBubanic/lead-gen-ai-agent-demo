"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";

function readInitialTheme(): Theme {
  if (typeof document === "undefined") return "light";
  const attr = document.documentElement.dataset.theme;
  if (attr === "dark" || attr === "light") return attr;
  try {
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    /* ignore */
  }
  if (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }
  return "light";
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(readInitialTheme());
    setMounted(true);
  }, []);

  const apply = (next: Theme) => {
    setTheme(next);
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = next;
    }
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* ignore */
    }
  };

  const toggle = () => apply(theme === "dark" ? "light" : "dark");

  return (
    <motion.button
      type="button"
      onClick={toggle}
      whileTap={{ scale: 0.92 }}
      whileHover={{ y: -1 }}
      aria-label={
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
      }
      title={
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
      }
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)]/70 bg-[var(--surface)]/60 text-[var(--muted)] backdrop-blur-sm transition hover:border-[var(--primary)]/40 hover:text-[var(--foreground)]",
        className
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        {mounted && theme === "dark" ? (
          <motion.span
            key="moon"
            initial={{ rotate: -40, opacity: 0, scale: 0.7 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 40, opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex items-center justify-center"
          >
            <Moon className="h-4 w-4" aria-hidden />
          </motion.span>
        ) : (
          <motion.span
            key="sun"
            initial={{ rotate: 40, opacity: 0, scale: 0.7 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: -40, opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex items-center justify-center"
          >
            <Sun className="h-4 w-4" aria-hidden />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
