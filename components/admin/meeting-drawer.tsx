"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Calendar,
  Clock,
  Copy,
  Mail,
  Phone,
  Trash2,
  User,
  Video,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatDashboardDateTime } from "@/lib/dashboard-datetime";
import { cn } from "@/lib/utils";
import type { SerializedMeeting } from "./types";

type MeetingDrawerProps = {
  open: boolean;
  day: Date | null;
  meetings: SerializedMeeting[];
  onClose: () => void;
  deleteAction: (formData: FormData) => void | Promise<void>;
};

function formatDay(d: Date) {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function humanDuration(start: Date, end: Date) {
  const mins = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  const hours = Math.floor(mins / 60);
  const minsRem = mins % 60;
  if (hours === 0) return `${minsRem} min`;
  if (minsRem === 0) return `${hours} h`;
  return `${hours} h ${minsRem} m`;
}

function typeMeta(type: string | null) {
  switch (type) {
    case "google_meet":
      return { label: "Google Meet", Icon: Video, color: "#34a853" };
    case "zoom":
      return { label: "Zoom", Icon: Video, color: "#2d8cff" };
    case "phone":
      return { label: "Phone", Icon: Phone, color: "#a855f7" };
    default:
      return { label: type ?? "Meeting", Icon: Calendar, color: "#6366f1" };
  }
}

function isUrl(s: string | null | undefined) {
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function MeetingDrawer({
  open,
  day,
  meetings,
  onClose,
  deleteAction,
}: MeetingDrawerProps) {
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const sorted = useMemo(
    () =>
      [...meetings].sort(
        (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
      ),
    [meetings]
  );

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm"
          />
          <motion.aside
            key="drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Meeting details"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="fixed right-0 top-0 z-50 flex h-[100dvh] w-full max-w-2xl flex-col overflow-hidden border-l border-[var(--border)] bg-[var(--surface)]/95 shadow-[var(--shadow-elevated)] backdrop-blur-xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                  Meetings on
                </p>
                <h2 className="text-lg font-semibold tracking-tight">
                  {day ? formatDay(day) : "—"}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              {sorted.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)]/50 px-5 py-10 text-center"
                >
                  <p className="text-sm text-[var(--muted)]">
                    No meetings scheduled for this day.
                  </p>
                </motion.div>
              ) : (
                <ul className="flex flex-col gap-4">
                  {sorted.map((m, i) => {
                    const start = new Date(m.startAt);
                    const end = new Date(m.endAt);
                    const meta = typeMeta(m.meetingType);
                    const urlLike = isUrl(m.locationDetail);
                    const Icon = meta.Icon;
                    return (
                      <motion.li
                        key={m.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]"
                      >
                        <div
                          className="h-1.5 w-full"
                          style={{
                            background: `linear-gradient(90deg, ${meta.color}, color-mix(in oklab, ${meta.color} 30%, transparent))`,
                          }}
                        />
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5"
                                  )}
                                  style={{
                                    background: `color-mix(in oklab, ${meta.color} 15%, transparent)`,
                                    color: meta.color,
                                  }}
                                >
                                  <Icon className="h-3 w-3" />
                                  {meta.label}
                                </span>
                                {m.bookedByAgent ? (
                                  <span className="inline-flex items-center rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]">
                                    Booked by agent
                                  </span>
                                ) : null}
                              </div>
                              <h3 className="mt-2 break-words text-base font-semibold leading-snug tracking-tight">
                                {m.title}
                              </h3>
                              <div className="mt-2 grid grid-cols-1 gap-1.5 text-sm text-[var(--muted)] sm:grid-cols-2">
                                <span className="inline-flex flex-wrap items-center gap-2">
                                  <Clock className="h-3.5 w-3.5 shrink-0" />
                                  <span className="min-w-0 break-words">
                                    Start:{" "}
                                    {formatDashboardDateTime(m.startAt)}
                                  </span>
                                </span>
                                <span className="inline-flex flex-wrap items-center gap-2">
                                  <Clock className="h-3.5 w-3.5 shrink-0" />
                                  <span className="min-w-0 break-words">
                                    End:{" "}
                                    {formatDashboardDateTime(m.endAt)}
                                  </span>
                                </span>
                                <span className="inline-flex items-center gap-2 sm:col-span-2">
                                  <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--primary)]" />
                                  {humanDuration(start, end)} total
                                </span>
                              </div>

                              <div className="mt-3 flex flex-col gap-1.5 text-sm">
                                {m.attendeeName ? (
                                  <span className="inline-flex items-center gap-2">
                                    <User className="h-3.5 w-3.5 text-[var(--muted)]" />
                                    <span className="font-medium">
                                      {m.attendeeName}
                                    </span>
                                  </span>
                                ) : null}
                                {m.attendeeEmail ? (
                                  <span className="inline-flex flex-wrap items-center gap-2">
                                    <Mail className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
                                    <a
                                      href={`mailto:${m.attendeeEmail}`}
                                      className="min-w-0 break-all text-[var(--primary)] hover:underline"
                                    >
                                      {m.attendeeEmail}
                                    </a>
                                  </span>
                                ) : null}
                                {m.locationDetail ? (
                                  <span className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/40 p-3">
                                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                                      {urlLike ? "Link" : "Location / dial-in"}
                                    </span>
                                    {urlLike ? (
                                      <a
                                        href={m.locationDetail}
                                        target="_blank"
                                        rel="noreferrer noopener"
                                        className="break-all text-sm font-medium text-[var(--primary)] hover:underline"
                                      >
                                        {m.locationDetail}
                                      </a>
                                    ) : (
                                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--foreground)]">
                                        {m.locationDetail}
                                      </p>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        void navigator.clipboard
                                          .writeText(m.locationDetail ?? "")
                                          .then(() => {
                                            setCopied(m.id + "-loc");
                                            window.setTimeout(
                                              () => setCopied(null),
                                              1200
                                            );
                                          });
                                      }}
                                      className="self-start rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[10px] font-medium text-[var(--muted)] transition hover:border-[var(--primary)]/40 hover:text-[var(--foreground)]"
                                    >
                                      {copied === m.id + "-loc" ? "Copied" : (
                                        <span className="inline-flex items-center gap-1">
                                          <Copy className="h-3 w-3" />
                                          Copy link or text
                                        </span>
                                      )}
                                    </button>
                                  </span>
                                ) : null}
                              </div>

                              {m.notes ? (
                                <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/60 p-3 text-sm">
                                  <div className="mb-1 flex items-center justify-between gap-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                                      Notes
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        void navigator.clipboard
                                          .writeText(m.notes ?? "")
                                          .then(() => {
                                            setCopied(m.id + "-notes");
                                            window.setTimeout(
                                              () => setCopied(null),
                                              1200
                                            );
                                          });
                                      }}
                                      className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--muted)] transition hover:border-[var(--primary)]/40"
                                    >
                                      {copied === m.id + "-notes" ? "Copied" : "Copy"}
                                    </button>
                                  </div>
                                  <p className="whitespace-pre-wrap break-words text-[var(--foreground)]">
                                    {m.notes}
                                  </p>
                                </div>
                              ) : null}
                            </div>
                          </div>

                          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex flex-col gap-0.5">
                              <p className="text-[11px] text-[var(--muted)]">
                                Saved{" "}
                                {formatDashboardDateTime(m.createdAt)}
                              </p>
                              <p className="break-all font-mono text-[10px] text-[var(--muted)]">
                                {m.id}
                              </p>
                            </div>
                            <form action={deleteAction}>
                              <input type="hidden" name="id" value={m.id} />
                              <button
                                type="submit"
                                className="inline-flex items-center gap-1 rounded-full border border-transparent px-2.5 py-1 text-[11px] font-medium text-[var(--muted)] transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-500"
                              >
                                <Trash2 className="h-3 w-3" />
                                Remove
                              </button>
                            </form>
                          </div>
                        </div>
                      </motion.li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
