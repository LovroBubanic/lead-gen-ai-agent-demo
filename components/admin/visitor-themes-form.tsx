"use client";

import { motion } from "framer-motion";
import { Palette, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import {
  VISITOR_PALETTE_OPTIONS,
  type VisitorPaletteId,
} from "@/lib/visitor-ui-palettes";

export function VisitorThemesForm({
  savedPalette,
  saveAction,
  onSaved,
}: {
  savedPalette: VisitorPaletteId;
  saveAction: (formData: FormData) => void | Promise<void>;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<VisitorPaletteId>(savedPalette);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setDraft(savedPalette);
  }, [savedPalette]);

  const dirty = draft !== savedPalette;

  const submit = useCallback(
    async (formData: FormData) => {
      await saveAction(formData);
      startTransition(() => {
        router.refresh();
        onSaved();
      });
    },
    [saveAction, onSaved, router]
  );

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex items-start gap-2">
        <Palette className="mt-0.5 h-5 w-5 shrink-0 text-[var(--primary)]" aria-hidden />
        <div>
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            Public chat &amp; voice look
          </h3>
          <p className="mt-1 text-[11px] text-[var(--muted)]">
            Applies to{" "}
            <code className="rounded bg-[var(--surface-muted)] px-1">/chat</code>{" "}
            and{" "}
            <code className="rounded bg-[var(--surface-muted)] px-1">/call</code>{" "}
            only. Visitors still choose light/dark with the theme toggle.
          </p>
        </div>
      </div>

      {dirty ? (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-900 dark:text-amber-100">
          Unsaved changes — click Save theme.
        </p>
      ) : null}

      <form action={(fd) => void submit(fd)} className="flex flex-col gap-4">
        <input type="hidden" name="visitorUiPalette" value={draft} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {VISITOR_PALETTE_OPTIONS.map((opt) => {
            const selected = draft === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDraft(opt.id)}
                className={`rounded-2xl border p-4 text-left transition ${
                  selected
                    ? "border-[var(--primary)] bg-[var(--primary)]/10 ring-2 ring-[var(--primary)]/30"
                    : "border-[var(--border)] bg-[var(--surface-muted)]/40 hover:border-[var(--primary)]/35"
                }`}
              >
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {opt.label}
                </p>
                <p className="mt-1 text-[11px] text-[var(--muted)]">{opt.hint}</p>
                <div
                  className="mt-3 h-2 w-full rounded-full"
                  style={{
                    background:
                      opt.id === "default"
                        ? "linear-gradient(90deg,#6366f1,#8b5cf6,#ec4899)"
                        : opt.id === "ocean"
                          ? "linear-gradient(90deg,#0e7490,#06b6d4,#38bdf8)"
                          : opt.id === "forest"
                            ? "linear-gradient(90deg,#047857,#10b981,#34d399)"
                            : opt.id === "sunset"
                              ? "linear-gradient(90deg,#ea580c,#fb923c,#f472b6)"
                              : "linear-gradient(90deg,#6d28d9,#8b5cf6,#22d3ee)",
                  }}
                />
              </button>
            );
          })}
        </div>
        <motion.button
          type="submit"
          disabled={isPending || !dirty}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          className="inline-flex w-fit items-center gap-2 rounded-full bg-[linear-gradient(135deg,#6366f1,#8b5cf6)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-40"
        >
          <Save className="h-4 w-4" aria-hidden />
          Save theme
        </motion.button>
      </form>
    </div>
  );
}
