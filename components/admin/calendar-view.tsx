"use client";

import { motion } from "framer-motion";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Phone,
  Video,
  Users,
  Dot,
} from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { SerializedMeeting } from "./types";

type CalendarViewProps = {
  meetings: SerializedMeeting[];
  onSelectDay: (day: Date, dayMeetings: SerializedMeeting[]) => void;
  selectedDayKey?: string | null;
};

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function toDayKey(d: Date) {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const weekday = (first.getDay() + 6) % 7; // Mon=0
  const start = new Date(first);
  start.setDate(first.getDate() - weekday);
  start.setHours(0, 0, 0, 0);
  return start;
}

function iconForType(type: string | null) {
  switch (type) {
    case "google_meet":
    case "zoom":
      return Video;
    case "phone":
      return Phone;
    default:
      return Users;
  }
}

export function CalendarView({
  meetings,
  onSelectDay,
  selectedDayKey,
}: CalendarViewProps) {
  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const { meetingsByDay, monthsWithMeetings } = useMemo(() => {
    const byDay = new Map<string, SerializedMeeting[]>();
    const months = new Set<string>();
    for (const m of meetings) {
      const start = new Date(m.startAt);
      const key = toDayKey(start);
      const arr = byDay.get(key) ?? [];
      arr.push(m);
      byDay.set(key, arr);
      months.add(`${start.getFullYear()}-${start.getMonth()}`);
    }
    for (const arr of byDay.values()) {
      arr.sort(
        (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
      );
    }
    return { meetingsByDay: byDay, monthsWithMeetings: months };
  }, [meetings]);

  const gridStart = startOfGrid(cursor.getFullYear(), cursor.getMonth());
  const days: Date[] = useMemo(() => {
    const arr: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, [gridStart]);

  const monthLabel = `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
  const hasDataInMonth = monthsWithMeetings.has(
    `${cursor.getFullYear()}-${cursor.getMonth()}`
  );

  const goPrev = () => {
    const d = new Date(cursor);
    d.setMonth(d.getMonth() - 1);
    setCursor(d);
  };
  const goNext = () => {
    const d = new Date(cursor);
    d.setMonth(d.getMonth() + 1);
    setCursor(d);
  };
  const goToday = () => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    setCursor(d);
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)]/85 shadow-[var(--shadow-soft)] backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-muted)]/60 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
            <CalendarDays className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
              {hasDataInMonth ? "Booked meetings" : "No bookings this month"}
            </p>
            <motion.h3
              key={monthLabel}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
              className="text-lg font-semibold tracking-tight"
            >
              {monthLabel}
            </motion.h3>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] p-1 text-sm shadow-sm">
          <button
            type="button"
            onClick={goPrev}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="rounded-full px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
          >
            Today
          </button>
          <button
            type="button"
            onClick={goNext}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--surface-muted)]/30 px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        {DOW.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <motion.div
        key={monthLabel}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="grid grid-cols-7 gap-px bg-[var(--border)]"
      >
        {days.map((d, i) => {
          const inMonth = d.getMonth() === cursor.getMonth();
          const key = toDayKey(d);
          const dayMeetings = meetingsByDay.get(key) ?? [];
          const isToday = sameDay(d, today);
          const isSelected = selectedDayKey === key;
          const hasMeetings = dayMeetings.length > 0;
          return (
            <motion.button
              key={key + i}
              type="button"
              whileHover={inMonth ? { y: -1 } : undefined}
              whileTap={inMonth ? { scale: 0.98 } : undefined}
              onClick={() => onSelectDay(d, dayMeetings)}
              disabled={!inMonth}
              className={cn(
                "group relative flex min-h-[84px] flex-col items-start gap-1.5 bg-[var(--surface)] p-2 text-left transition sm:min-h-[100px]",
                !inMonth && "bg-[var(--surface-muted)]/40 text-[var(--muted)]/60",
                inMonth && "hover:bg-[var(--surface-muted)]/70",
                isSelected &&
                  "bg-[color-mix(in_oklab,var(--primary)_10%,var(--surface))] ring-1 ring-[var(--primary)]/60"
              )}
            >
              <div className="flex w-full items-center justify-between">
                <span
                  className={cn(
                    "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold tabular-nums",
                    isToday &&
                      "bg-[linear-gradient(135deg,#6366f1,#8b5cf6)] text-white shadow-[0_0_12px_rgba(129,140,248,0.55)]",
                    !isToday && isSelected && "bg-[var(--primary)]/10 text-[var(--primary)]",
                    !isToday && !isSelected && inMonth && "text-[var(--foreground)]",
                    !inMonth && "text-[var(--muted)]/60"
                  )}
                >
                  {d.getDate()}
                </span>
                {hasMeetings ? (
                  <span
                    className={cn(
                      "rounded-full border px-1.5 text-[10px] font-medium leading-[18px]",
                      "border-[var(--primary)]/35 bg-[var(--primary)]/10 text-[var(--primary)]"
                    )}
                  >
                    {dayMeetings.length}
                  </span>
                ) : null}
              </div>
              <div className="mt-0.5 flex w-full flex-col gap-1">
                {dayMeetings.slice(0, 2).map((m) => {
                  const Icon = iconForType(m.meetingType);
                  const time = new Date(m.startAt).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  });
                  return (
                    <span
                      key={m.id}
                      className="flex items-center gap-1 truncate rounded-md border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--foreground)] shadow-sm"
                      title={`${time} — ${m.title}`}
                    >
                      <Icon className="h-2.5 w-2.5 shrink-0 text-[var(--primary)]" />
                      <span className="truncate">
                        <span className="text-[var(--muted)]">{time}</span>{" "}
                        {m.title}
                      </span>
                    </span>
                  );
                })}
                {dayMeetings.length > 2 ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--muted)]">
                    <Dot className="h-3 w-3" /> +{dayMeetings.length - 2} more
                  </span>
                ) : null}
              </div>
            </motion.button>
          );
        })}
      </motion.div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] bg-[var(--surface-muted)]/40 px-4 py-2.5 text-[11px] text-[var(--muted)]">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-[linear-gradient(135deg,#6366f1,#8b5cf6)]" />
            Today
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--primary)]/40" />
            Booked
          </span>
        </div>
        <p>Click any day to see full meeting details.</p>
      </div>
    </div>
  );
}
