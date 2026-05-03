"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";

/** Applies theme to `document.documentElement`, localStorage, and persists to DB (admin only). */
export function DashboardThemeToggle({
  savedTheme,
  saveAction,
  className,
}: {
  savedTheme: Theme;
  saveAction: (formData: FormData) => void | Promise<void>;
  className?: string;
}) {
  const [theme, setTheme] = useState<Theme>(savedTheme);
  const [mounted, setMounted] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setTheme(savedTheme);
  }, [savedTheme]);

  useEffect(() => {
    setMounted(true);
    document.documentElement.dataset.theme = savedTheme;
    try {
      localStorage.setItem("theme", savedTheme);
    } catch {
      /* ignore */
    }
  }, [savedTheme]);

  const applyLocal = (next: Theme) => {
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* ignore */
    }
  };

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    applyLocal(next);
    const fd = new FormData();
    fd.set("dashboardTheme", next);
    startTransition(() => {
      void Promise.resolve(saveAction(fd));
    });
  };

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
