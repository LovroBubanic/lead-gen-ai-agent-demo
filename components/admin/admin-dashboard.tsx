"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  BookOpen,
  Bot,
  CalendarDays,
  ChevronDown,
  Copy,
  FileText,
  Filter,
  LayoutDashboard,
  LogOut,
  Image as ImageIcon,
  MessageSquare,
  Pencil,
  Phone,
  Search,
  Upload,
  Users,
  Video,
  Zap,
  Trash2,
  PlusCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import {
  defaultOwnerCalendarMonth,
  startOfLocalDay,
  toDayKey,
} from "@/lib/admin-meeting-dates";
import {
  formatDashboardDateTime,
  formatRelativeOrAbsolute,
} from "@/lib/dashboard-datetime";
import { CalendarView } from "./calendar-view";
import { MeetingDrawer } from "./meeting-drawer";
import type {
  SerializedKnowledge,
  SerializedLead,
  SerializedMeeting,
} from "./types";
import { cn } from "@/lib/utils";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { CUSTOMER_LOCALE_OPTIONS } from "@/lib/locales";
import { OPENAI_REALTIME_VOICE_OPTIONS } from "@/lib/openai-realtime-voices";
import { CountUp } from "@/components/ui/count-up";
import { FadeIn } from "@/components/ui/fade-in";
import { GradientText } from "@/components/ui/gradient-text";
import { ShinyText } from "@/components/ui/shiny-text";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { ThemeToggle } from "@/components/ui/theme-toggle";

type DashboardActions = {
  addKnowledgeDocument: (formData: FormData) => void | Promise<void>;
  deleteKnowledgeForm: (formData: FormData) => void | Promise<void>;
  deleteLeadForm: (formData: FormData) => void | Promise<void>;
  deleteMeetingForm: (formData: FormData) => void | Promise<void>;
  logoutDashboard: () => void | Promise<void>;
  uploadKnowledgePdf: (formData: FormData) => void | Promise<void>;
  saveCustomerInstructions: (formData: FormData) => void | Promise<void>;
  saveCustomerLocale: (formData: FormData) => void | Promise<void>;
  saveRealtimeVoice: (formData: FormData) => void | Promise<void>;
  updateLeadForm: (formData: FormData) => void | Promise<void>;
  updateMeetingForm: (formData: FormData) => void | Promise<void>;
};

type AdminDashboardProps = {
  leads: SerializedLead[];
  meetings: SerializedMeeting[];
  docs: SerializedKnowledge[];
  customerInstructions: string;
  customerLocale: string;
  realtimeVoice: string;
  actions: DashboardActions;
  supabaseConfigured: boolean;
  /** Set when Prisma could not load lists (missing env, DB down, schema drift). */
  dataLoadError?: string | null;
};

type TabId = "overview" | "leads" | "calendar" | "knowledge" | "assistant";

const TABS: {
  id: TabId;
  label: string;
  icon: typeof LayoutDashboard;
}[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "leads", label: "Leads", icon: Users },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "knowledge", label: "Knowledge", icon: BookOpen },
  { id: "assistant", label: "AI replies", icon: Bot },
];

function startOfWeek(d: Date) {
  const t = new Date(d);
  const day = (t.getDay() + 6) % 7;
  t.setDate(t.getDate() - day);
  t.setHours(0, 0, 0, 0);
  return t;
}

function initials(name: string | null, email: string | null) {
  const base = (name ?? email ?? "?").trim();
  if (!base) return "?";
  const parts = base.split(/[\s@.]+/).filter(Boolean);
  const letters = parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return letters || base[0].toUpperCase();
}

function leadDetailsPlainText(l: SerializedLead): string {
  const captured = formatDashboardDateTime(l.createdAt);
  return [
    `Lead ID: ${l.id}`,
    `Captured: ${captured}`,
    `Name: ${l.name?.trim() || "—"}`,
    `Email: ${l.email?.trim() || "—"}`,
    "",
    "Intent / topic:",
    l.intent?.trim() || "—",
    "",
    "Conversation summary (highlights):",
    l.summary?.trim() || "—",
  ].join("\n");
}

function avatarGradient(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const hue = h % 360;
  return `linear-gradient(135deg, hsl(${hue} 80% 62%), hsl(${(hue + 60) % 360} 80% 58%))`;
}

export function AdminDashboard({
  leads,
  meetings,
  docs,
  customerInstructions,
  customerLocale,
  realtimeVoice,
  actions,
  supabaseConfigured,
  dataLoadError = null,
}: AdminDashboardProps) {
  const [tab, setTab] = useState<TabId>("overview");
  const [query, setQuery] = useState("");
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedDayMeetings, setSelectedDayMeetings] = useState<
    SerializedMeeting[]
  >([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expandedLeadIds, setExpandedLeadIds] = useState<Set<string>>(
    () => new Set()
  );
  const [leadCopyFlashId, setLeadCopyFlashId] = useState<string | null>(null);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [leadEditId, setLeadEditId] = useState<string | null>(null);

  const filteredLeads = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) =>
      [l.name, l.email, l.intent, l.summary]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q))
    );
  }, [leads, query]);

  const stats = useMemo(() => {
    const nowTs = Date.now();
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const weekStart = startOfWeek(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const upcoming = meetings.filter(
      (m) => new Date(m.endAt).getTime() >= nowTs
    );
    const thisWeek = meetings.filter((m) => {
      const s = new Date(m.startAt).getTime();
      const e = new Date(m.endAt).getTime();
      return s < weekEnd.getTime() && e > weekStart.getTime();
    });
    const last7d = leads.filter(
      (l) => Date.now() - new Date(l.createdAt).getTime() < 7 * 86_400_000
    );

    return {
      totalLeads: leads.length,
      leadsLast7: last7d.length,
      totalMeetings: meetings.length,
      upcomingMeetings: upcoming.length,
      thisWeekMeetings: thisWeek.length,
      knowledgeDocs: docs.length,
    };
  }, [leads, meetings, docs]);

  const nextMeeting = useMemo(() => {
    const now = Date.now();
    const candidates = meetings
      .filter((m) => new Date(m.endAt).getTime() >= now)
      .sort(
        (a, b) =>
          new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
      );
    return candidates[0] ?? null;
  }, [meetings]);

  const latestRecordedMeeting = useMemo(() => {
    if (meetings.length === 0) return null;
    return [...meetings].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0]!;
  }, [meetings]);

  const recentBookings = useMemo(
    () =>
      [...meetings].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [meetings]
  );

  const calendarInitialMonth = useMemo(
    () => defaultOwnerCalendarMonth(meetings),
    [meetings]
  );

  const openDayDrawer = useCallback(
    (day: Date, dayMeetings: SerializedMeeting[]) => {
      setSelectedDay(day);
      setSelectedDayKey(toDayKey(day));
      setSelectedDayMeetings(dayMeetings);
      setDrawerOpen(true);
    },
    []
  );

  const openMeetingInDrawer = useCallback(
    (m: SerializedMeeting) => {
      const day = startOfLocalDay(new Date(m.startAt));
      const key = toDayKey(day);
      const dayMeetings = meetings.filter(
        (x) => toDayKey(new Date(x.startAt)) === key
      );
      openDayDrawer(day, dayMeetings);
    },
    [meetings, openDayDrawer]
  );

  const toggleLeadExpanded = useCallback((id: string) => {
    setExpandedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setLeadEditId((cur) => (cur === id ? null : cur));
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const copyLeadDetails = useCallback((l: SerializedLead) => {
    void navigator.clipboard.writeText(leadDetailsPlainText(l)).then(() => {
      setLeadCopyFlashId(l.id);
      window.setTimeout(() => setLeadCopyFlashId(null), 1600);
    });
  }, []);

  const pendingNavId = `admin-tab-${tab}`;

  return (
    <AuroraBackground className="min-h-[100dvh]">
      {dataLoadError ? (
        <div
          className="border-b border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100"
          role="alert"
        >
          <div className="mx-auto flex max-w-6xl gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div>
              <p className="font-semibold">Dashboard data could not be loaded</p>
              <p className="mt-1 text-[13px] opacity-90">{dataLoadError}</p>
              <p className="mt-2 text-[12px] opacity-80">
                Confirm{" "}
                <code className="rounded bg-black/10 px-1 py-0.5 dark:bg-white/10">
                  DATABASE_URL
                </code>{" "}
                and{" "}
                <code className="rounded bg-black/10 px-1 py-0.5 dark:bg-white/10">
                  DIRECT_URL
                </code>{" "}
                on the host (e.g. Vercel), run{" "}
                <code className="rounded bg-black/10 px-1 py-0.5 dark:bg-white/10">
                  prisma db push
                </code>{" "}
                or migrations, then redeploy. Public chat can still open because it
                does not query leads or meetings.
              </p>
            </div>
          </div>
        </div>
      ) : null}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-30 border-b border-[var(--border)]/70 bg-[var(--surface)]/75 px-4 py-3 backdrop-blur-xl"
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="leading-tight">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                <ShinyText>Lead/Booking Agent · private</ShinyText>
              </p>
              <p className="text-[15px] font-semibold tracking-tight">
                Owner dashboard
              </p>
            </div>
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/chat"
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)]/60 px-3 py-1.5 text-xs font-medium text-[var(--muted)] backdrop-blur-sm transition hover:border-[var(--primary)]/40 hover:text-[var(--foreground)]"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Public chat
            </Link>
            <Link
              href="/call"
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)]/60 px-3 py-1.5 text-xs font-medium text-[var(--muted)] backdrop-blur-sm transition hover:border-[var(--primary)]/40 hover:text-[var(--foreground)]"
            >
              <Phone className="h-3.5 w-3.5" />
              Voice
            </Link>
            <form action={actions.logoutDashboard}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)]/60 px-3 py-1.5 text-xs font-medium text-[var(--muted)] backdrop-blur-sm transition hover:border-red-500/40 hover:text-red-500"
              >
                <LogOut className="h-3.5 w-3.5" />
                Log out
              </button>
            </form>
            <ThemeToggle />
          </div>
        </div>
      </motion.header>

      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[220px_1fr]">
        <motion.aside
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          className="sticky top-[78px] hidden h-max flex-col gap-1 rounded-3xl border border-[var(--border)] bg-[var(--surface)]/75 p-2 shadow-[var(--shadow-soft)] backdrop-blur-xl lg:flex"
        >
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "relative flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "text-[var(--foreground)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                )}
              >
                {active ? (
                  <motion.span
                    layoutId={pendingNavId}
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    className="absolute inset-0 rounded-2xl bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                  />
                ) : null}
                <span className="relative z-10 inline-flex items-center gap-2">
                  <t.icon className="h-4 w-4" />
                  {t.label}
                </span>
              </button>
            );
          })}
        </motion.aside>

        <div className="flex flex-col gap-6">
          <div className="flex overflow-x-auto rounded-full border border-[var(--border)] bg-[var(--surface)]/75 p-1 shadow-sm backdrop-blur-md lg:hidden">
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "relative inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium transition",
                    active
                      ? "bg-[linear-gradient(135deg,#6366f1,#8b5cf6)] text-white shadow-[0_10px_30px_-12px_rgba(99,102,241,0.6)]"
                      : "text-[var(--muted)]"
                  )}
                >
                  <t.icon className="h-4 w-4" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            {tab === "overview" ? (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col gap-6"
              >
                <OverviewHero
                  nextMeeting={nextMeeting}
                  latestMeeting={latestRecordedMeeting}
                  onOpenMeeting={openMeetingInDrawer}
                />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard
                    title="Total leads"
                    value={stats.totalLeads}
                    hint={`${stats.leadsLast7} new · last 7 days`}
                    gradient="from-[#6366f1] to-[#8b5cf6]"
                    delay={0}
                  />
                  <StatCard
                    title="Meetings upcoming"
                    value={stats.upcomingMeetings}
                    hint={`${stats.thisWeekMeetings} this calendar week`}
                    gradient="from-[#22d3ee] to-[#6366f1]"
                    delay={0.05}
                  />
                  <StatCard
                    title="Knowledge docs"
                    value={stats.knowledgeDocs}
                    hint="injected into the agent"
                    gradient="from-[#ec4899] to-[#8b5cf6]"
                    delay={0.1}
                  />
                  <StatCard
                    title="Total bookings"
                    value={stats.totalMeetings}
                    hint="since launch"
                    gradient="from-[#10b981] to-[#22d3ee]"
                    delay={0.15}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <FadeIn>
                    <SpotlightCard>
                      <div className="flex flex-col gap-4 p-5">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold tracking-tight">
                            Recent leads
                          </h3>
                          <button
                            type="button"
                            onClick={() => setTab("leads")}
                            className="text-xs font-medium text-[var(--primary)] hover:underline"
                          >
                            View all
                          </button>
                        </div>
                        {leads.length === 0 ? (
                          <p className="text-sm text-[var(--muted)]">
                            No leads yet. When visitors share contact details in{" "}
                            <Link
                              href="/chat"
                              className="text-[var(--primary)] underline-offset-2 hover:underline"
                            >
                              chat
                            </Link>
                            , they&apos;ll appear here.
                          </p>
                        ) : (
                          <ul className="flex flex-col divide-y divide-[var(--border)]">
                            {leads.slice(0, 5).map((l, i) => (
                              <motion.li
                                key={l.id}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                              >
                                <span
                                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white shadow-sm"
                                  style={{
                                    background: avatarGradient(
                                      l.id + (l.email ?? "")
                                    ),
                                  }}
                                >
                                  {initials(l.name, l.email)}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium">
                                    {l.name ?? l.email ?? "Unnamed lead"}
                                  </p>
                                  <p className="truncate text-xs text-[var(--muted)]">
                                    {l.intent ?? l.summary ?? "—"}
                                  </p>
                                </div>
                                <span className="text-[10px] text-[var(--muted)]">
                                  {formatRelativeOrAbsolute(l.createdAt)}
                                </span>
                              </motion.li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </SpotlightCard>
                  </FadeIn>

                  <FadeIn delay={0.08}>
                    <SpotlightCard>
                      <div className="flex flex-col gap-4 p-5">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold tracking-tight">
                            Quick actions
                          </h3>
                          <span className="rounded-full bg-[var(--primary)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--primary)]">
                            tips
                          </span>
                        </div>
                        <ul className="flex flex-col gap-2.5 text-sm">
                          {[
                            {
                              icon: BookOpen,
                              label: "Upload a PDF or add a note",
                              desc:
                                "Inject your FAQs, pricing, and hours into the agent.",
                              onClick: () => setTab("knowledge"),
                            },
                            {
                              icon: Bot,
                              label: "Tune how the AI replies to visitors",
                              desc:
                                "Set tone, what to emphasize, and what to avoid in chat and voice.",
                              onClick: () => setTab("assistant"),
                            },
                            {
                              icon: CalendarDays,
                              label: "Browse the meeting calendar",
                              desc:
                                "Click any day to see all bookings, notes, and links.",
                              onClick: () => setTab("calendar"),
                            },
                            {
                              icon: Zap,
                              label: "Test a chat as a visitor",
                              desc:
                                "Open /chat or /call and send yourself a test lead.",
                              onClick: undefined,
                              href: "/chat",
                            },
                          ].map((item) => (
                            <li key={item.label}>
                              {item.href ? (
                                <Link
                                  href={item.href}
                                  className="group flex w-full items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]/70 px-3 py-2.5 text-left transition hover:border-[var(--primary)]/40"
                                >
                                  <QuickActionIcon Icon={item.icon} />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium">
                                      {item.label}
                                    </p>
                                    <p className="text-xs text-[var(--muted)]">
                                      {item.desc}
                                    </p>
                                  </div>
                                </Link>
                              ) : (
                                <button
                                  type="button"
                                  onClick={item.onClick}
                                  className="group flex w-full items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]/70 px-3 py-2.5 text-left transition hover:border-[var(--primary)]/40"
                                >
                                  <QuickActionIcon Icon={item.icon} />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium">
                                      {item.label}
                                    </p>
                                    <p className="text-xs text-[var(--muted)]">
                                      {item.desc}
                                    </p>
                                  </div>
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </SpotlightCard>
                  </FadeIn>
                </div>

                <FadeIn delay={0.06}>
                  <SpotlightCard>
                    <div className="flex flex-col gap-4 p-5">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold tracking-tight">
                          Recent bookings
                        </h3>
                        <button
                          type="button"
                          onClick={() => setTab("calendar")}
                          className="text-xs font-medium text-[var(--primary)] hover:underline"
                        >
                          Open calendar
                        </button>
                      </div>
                      {meetings.length === 0 ? (
                        <p className="text-sm text-[var(--muted)]">
                          When visitors confirm a slot in chat or voice, each
                          booking appears here and on the calendar.
                        </p>
                      ) : (
                        <ul className="flex flex-col divide-y divide-[var(--border)]">
                          {recentBookings.slice(0, 8).map((m, i) => {
                            return (
                              <motion.li
                                key={m.id}
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.04 }}
                              >
                                <button
                                  type="button"
                                  onClick={() => openMeetingInDrawer(m)}
                                  className="flex w-full flex-col gap-1 py-3 text-left transition first:pt-0 last:pb-0 hover:bg-[var(--surface-muted)]/50"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="min-w-0 flex-1 break-words text-sm font-medium">
                                      {m.title}
                                    </span>
                                    <span className="shrink-0 text-[10px] text-[var(--muted)]">
                                      {formatRelativeOrAbsolute(m.createdAt)}
                                    </span>
                                  </div>
                                  <p className="text-xs text-[var(--muted)]">
                                    {formatDashboardDateTime(m.startAt)}
                                    {m.attendeeName
                                      ? ` · ${m.attendeeName}`
                                      : ""}
                                  </p>
                                </button>
                              </motion.li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </SpotlightCard>
                </FadeIn>
              </motion.div>
            ) : null}

            {tab === "leads" ? (
              <motion.div
                key="leads"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col gap-5"
              >
                <div className="flex flex-col gap-3 rounded-3xl border border-[var(--border)] bg-[var(--surface)]/80 p-5 shadow-[var(--shadow-soft)] backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                      Captured leads
                    </p>
                    <h2 className="mt-1 text-xl font-semibold tracking-tight">
                      <GradientText>Leads</GradientText>
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-muted)]/70 px-3 py-1.5 text-sm shadow-inner">
                    <Search className="h-4 w-4 text-[var(--muted)]" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search name, email, intent…"
                      className="w-full min-w-40 bg-transparent text-sm outline-none placeholder:text-[var(--muted)]"
                    />
                    {query ? (
                      <button
                        type="button"
                        onClick={() => setQuery("")}
                        className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
                      >
                        Clear
                      </button>
                    ) : (
                      <Filter className="h-3.5 w-3.5 text-[var(--muted)]" />
                    )}
                  </div>
                </div>

                {filteredLeads.length === 0 ? (
                  <EmptyState
                    title={query ? "No matches" : "No leads yet"}
                    body={
                      query
                        ? "Try a different search term."
                        : "When visitors share contact details via chat or voice, they will show up here in real time."
                    }
                  />
                ) : (
                  <div className="flex flex-col gap-3">
                    <p className="text-xs text-[var(--muted)]">
                      Click a lead to expand full intent and conversation highlights.
                      Use copy to grab everything for your CRM or email.
                    </p>
                    <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)]/85 shadow-[var(--shadow-soft)] backdrop-blur-md">
                      <ul className="divide-y divide-[var(--border)]">
                        <AnimatePresence initial={false}>
                          {filteredLeads.map((l, i) => {
                            const expanded = expandedLeadIds.has(l.id);
                            return (
                              <motion.li
                                key={l.id}
                                layout
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ delay: Math.min(i * 0.02, 0.25) }}
                                className="bg-[var(--surface)]"
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleLeadExpanded(l.id)}
                                  aria-expanded={expanded}
                                  className="flex w-full items-start gap-3 px-4 py-3.5 text-left text-sm transition hover:bg-[var(--surface-muted)]/50"
                                >
                                  <span
                                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                                    style={{
                                      background: avatarGradient(
                                        l.id + (l.email ?? "")
                                      ),
                                    }}
                                  >
                                    {initials(l.name, l.email)}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                      <span className="font-semibold text-[var(--foreground)]">
                                        {l.name?.trim() || "Unnamed lead"}
                                      </span>
                                      <span className="text-[11px] text-[var(--muted)]">
                                        {formatRelativeOrAbsolute(l.createdAt)}
                                      </span>
                                    </div>
                                    <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                                      {l.email ? (
                                        <span className="text-[var(--primary)]">
                                          {l.email}
                                        </span>
                                      ) : (
                                        "No email"
                                      )}
                                    </p>
                                    {!expanded && (l.intent || l.summary) ? (
                                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--muted)]">
                                        {l.summary?.trim() ||
                                          l.intent?.trim() ||
                                          ""}
                                      </p>
                                    ) : null}
                                  </div>
                                  <ChevronDown
                                    className={cn(
                                      "mt-1 h-4 w-4 shrink-0 text-[var(--muted)] transition-transform duration-200",
                                      expanded && "rotate-180"
                                    )}
                                    aria-hidden
                                  />
                                </button>
                                <AnimatePresence initial={false}>
                                  {expanded ? (
                                    <motion.div
                                      key="detail"
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: "auto", opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{
                                        duration: 0.22,
                                        ease: [0.22, 1, 0.36, 1],
                                      }}
                                      className="overflow-hidden border-t border-[var(--border)] bg-[var(--surface-muted)]/35"
                                    >
                                      <div className="space-y-4 px-4 py-4">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                                            Full lead record
                                          </p>
                                          <div className="flex flex-wrap items-center gap-2">
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                copyLeadDetails(l);
                                              }}
                                              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[11px] font-medium text-[var(--foreground)] transition hover:border-[var(--primary)]/40"
                                            >
                                              <Copy className="h-3 w-3" />
                                              {leadCopyFlashId === l.id
                                                ? "Copied"
                                                : "Copy all"}
                                            </button>
                                            {leadEditId !== l.id ? (
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setLeadEditId(l.id);
                                                }}
                                                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[11px] font-medium text-[var(--foreground)] transition hover:border-[var(--primary)]/40"
                                              >
                                                <Pencil className="h-3 w-3" />
                                                Edit
                                              </button>
                                            ) : (
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setLeadEditId(null);
                                                }}
                                                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[11px] font-medium text-[var(--muted)] transition hover:text-[var(--foreground)]"
                                              >
                                                Cancel edit
                                              </button>
                                            )}
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (
                                                  !confirm(
                                                    "Delete this lead permanently?"
                                                  )
                                                )
                                                  return;
                                                const fd = new FormData();
                                                fd.set("id", l.id);
                                                startTransition(() => {
                                                  void Promise.resolve(
                                                    actions.deleteLeadForm(fd)
                                                  ).then(() => {
                                                      setExpandedLeadIds(
                                                        (prev) => {
                                                          const n = new Set(
                                                            prev
                                                          );
                                                          n.delete(l.id);
                                                          return n;
                                                        }
                                                      );
                                                      setLeadEditId((cur) =>
                                                        cur === l.id ? null : cur
                                                      );
                                                      router.refresh();
                                                    });
                                                });
                                              }}
                                              className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-[var(--surface)] px-3 py-1 text-[11px] font-medium text-red-600 transition hover:bg-red-500/10 dark:text-red-400"
                                            >
                                              <Trash2 className="h-3 w-3" />
                                              Delete
                                            </button>
                                          </div>
                                        </div>
                                        {leadEditId === l.id ? (
                                          <form
                                            key={`edit-${l.id}`}
                                            className="space-y-3"
                                            onSubmit={(e) => {
                                              e.preventDefault();
                                              const fd = new FormData(
                                                e.currentTarget
                                              );
                                              startTransition(() => {
                                                void Promise.resolve(
                                                  actions.updateLeadForm(fd)
                                                ).then(() => {
                                                    setLeadEditId(null);
                                                    router.refresh();
                                                  });
                                              });
                                            }}
                                          >
                                            <input
                                              type="hidden"
                                              name="id"
                                              value={l.id}
                                            />
                                            <label className="flex flex-col gap-1 text-xs">
                                              <span className="font-medium text-[var(--muted)]">
                                                Name
                                              </span>
                                              <input
                                                name="name"
                                                defaultValue={l.name ?? ""}
                                                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                                              />
                                            </label>
                                            <label className="flex flex-col gap-1 text-xs">
                                              <span className="font-medium text-[var(--muted)]">
                                                Email
                                              </span>
                                              <input
                                                name="email"
                                                type="email"
                                                defaultValue={l.email ?? ""}
                                                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                                              />
                                            </label>
                                            <label className="flex flex-col gap-1 text-xs">
                                              <span className="font-medium text-[var(--muted)]">
                                                Intent / topic
                                              </span>
                                              <textarea
                                                name="intent"
                                                defaultValue={l.intent ?? ""}
                                                rows={3}
                                                className="resize-y rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                                              />
                                            </label>
                                            <label className="flex flex-col gap-1 text-xs">
                                              <span className="font-medium text-[var(--muted)]">
                                                Conversation highlights
                                              </span>
                                              <textarea
                                                name="summary"
                                                defaultValue={l.summary ?? ""}
                                                rows={8}
                                                className="max-h-[40vh] resize-y rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                                              />
                                            </label>
                                            <p className="text-[10px] text-[var(--muted)]">
                                              Capture time (
                                              {formatDashboardDateTime(
                                                l.createdAt
                                              )}
                                              ) is not editable here.
                                            </p>
                                            <button
                                              type="submit"
                                              disabled={isPending}
                                              className="inline-flex w-fit items-center gap-2 rounded-full bg-[linear-gradient(135deg,#6366f1,#8b5cf6)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
                                            >
                                              Save lead
                                            </button>
                                          </form>
                                        ) : (
                                          <dl className="grid gap-3 text-sm">
                                            <div>
                                              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                                                Email
                                              </dt>
                                              <dd className="mt-1 break-all">
                                                {l.email ? (
                                                  <a
                                                    href={`mailto:${l.email}`}
                                                    className="text-[var(--primary)] hover:underline"
                                                  >
                                                    {l.email}
                                                  </a>
                                                ) : (
                                                  <span className="text-[var(--muted)]">
                                                    —
                                                  </span>
                                                )}
                                              </dd>
                                            </div>
                                            <div>
                                              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                                                Intent / topic
                                              </dt>
                                              <dd className="mt-1 whitespace-pre-wrap break-words leading-relaxed text-[var(--foreground)]">
                                                {l.intent?.trim() || (
                                                  <span className="text-[var(--muted)]">
                                                    —
                                                  </span>
                                                )}
                                              </dd>
                                            </div>
                                            <div>
                                              <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                                                <MessageSquare className="h-3 w-3" />
                                                Conversation highlights
                                              </dt>
                                              <dd className="mt-1 space-y-2">
                                                <p className="text-[10px] leading-snug text-[var(--muted)]">
                                                  Text below is written by the
                                                  AI for you — any dates inside
                                                  it are not verified. Use{" "}
                                                  <strong>Captured at</strong>{" "}
                                                  for when this lead was saved.
                                                </p>
                                                <div className="max-h-[min(70vh,28rem)] overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-[13px] leading-relaxed text-[var(--foreground)]">
                                                  {l.summary?.trim() || (
                                                    <span className="text-[var(--muted)]">
                                                      No summary was stored for
                                                      this lead (the agent may
                                                      not have called capture
                                                      with a summary).
                                                    </span>
                                                  )}
                                                </div>
                                              </dd>
                                            </div>
                                            <div>
                                              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                                                Lead ID
                                              </dt>
                                              <dd className="mt-1 break-all font-mono text-xs text-[var(--muted)]">
                                                {l.id}
                                              </dd>
                                            </div>
                                            <div>
                                              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                                                Captured at
                                              </dt>
                                              <dd className="mt-1 text-xs text-[var(--foreground)]">
                                                {formatDashboardDateTime(
                                                  l.createdAt
                                                )}
                                              </dd>
                                            </div>
                                          </dl>
                                        )}
                                      </div>
                                    </motion.div>
                                  ) : null}
                                </AnimatePresence>
                              </motion.li>
                            );
                          })}
                        </AnimatePresence>
                      </ul>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : null}

            {tab === "calendar" ? (
              <motion.div
                key="calendar"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col gap-5"
              >
                <div className="flex flex-col gap-1 rounded-3xl border border-[var(--border)] bg-[var(--surface)]/80 p-5 shadow-[var(--shadow-soft)] backdrop-blur-md">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    Meetings calendar
                  </p>
                  <h2 className="text-xl font-semibold tracking-tight">
                    <GradientText>Booked meetings</GradientText>
                  </h2>
                  <p className="text-sm text-[var(--muted)]">
                    Click any day to open full meeting details — attendees,
                    links, notes, and more.
                  </p>
                </div>

                <CalendarView
                  meetings={meetings}
                  initialCursorMonth={calendarInitialMonth}
                  onSelectDay={openDayDrawer}
                  selectedDayKey={selectedDayKey}
                />

                <UpcomingMeetingsList
                  meetings={meetings}
                  onSelect={openMeetingInDrawer}
                />
              </motion.div>
            ) : null}

            {tab === "knowledge" ? (
              <motion.div
                key="knowledge"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col gap-5"
              >
                <div className="flex flex-col gap-1 rounded-3xl border border-[var(--border)] bg-[var(--surface)]/80 p-5 shadow-[var(--shadow-soft)] backdrop-blur-md">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    Agent memory
                  </p>
                  <h2 className="text-xl font-semibold tracking-tight">
                    <GradientText>Knowledge base</GradientText>
                  </h2>
                  <p className="text-sm text-[var(--muted)]">
                    Text and PDFs you upload are injected into the agent&apos;s
                    system prompt — nothing here is shown to customers.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <FadeIn>
                    <SpotlightCard>
                      <div className="flex flex-col gap-3 p-5">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="flex items-center gap-2 text-sm font-semibold">
                            <Upload className="h-4 w-4 text-[var(--primary)]" />
                            Upload a PDF
                          </h3>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-medium",
                              supabaseConfigured
                                ? "bg-emerald-500/15 text-emerald-500"
                                : "bg-amber-500/15 text-amber-600 dark:text-amber-300"
                            )}
                          >
                            {supabaseConfigured
                              ? "Storage ready"
                              : "Text-only mode"}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--muted)]">
                          Max 8 MB. Text is extracted on the server.
                          {!supabaseConfigured ? (
                            <>
                              {" "}Set{" "}
                              <code className="rounded bg-[var(--surface-muted)] px-1">
                                SUPABASE_SERVICE_ROLE_KEY
                              </code>{" "}
                              to also archive originals.
                            </>
                          ) : null}
                        </p>
                        <form
                          action={actions.uploadKnowledgePdf}
                          className="flex flex-col gap-3"
                        >
                          <input
                            type="file"
                            name="pdf"
                            accept="application/pdf"
                            required
                            className="block w-full text-sm"
                          />
                          <motion.button
                            type="submit"
                            whileHover={{ y: -1 }}
                            whileTap={{ scale: 0.97 }}
                            className="inline-flex items-center gap-1.5 self-start rounded-full bg-[linear-gradient(135deg,#6366f1,#8b5cf6)] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_30px_-12px_rgba(99,102,241,0.7)] transition hover:brightness-110"
                          >
                            <Upload className="h-4 w-4" />
                            Ingest PDF
                          </motion.button>
                        </form>
                      </div>
                    </SpotlightCard>
                  </FadeIn>

                  <FadeIn delay={0.08}>
                    <SpotlightCard>
                      <div className="flex flex-col gap-3 p-5">
                        <h3 className="flex items-center gap-2 text-sm font-semibold">
                          <PlusCircle className="h-4 w-4 text-[var(--primary)]" />
                          Add a text note
                        </h3>
                        <form
                          action={actions.addKnowledgeDocument}
                          className="flex flex-col gap-3"
                        >
                          <label className="flex flex-col gap-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                              Title
                            </span>
                            <input
                              name="title"
                              required
                              placeholder="e.g. Pricing & packages"
                              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm outline-none ring-[var(--primary)]/40 transition focus:ring-2"
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                              Content
                            </span>
                            <textarea
                              name="content"
                              required
                              rows={5}
                              placeholder="Paste FAQs, services, hours, tone guidelines…"
                              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm outline-none ring-[var(--primary)]/40 transition focus:ring-2"
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                              Listing photos (optional)
                            </span>
                            <input
                              type="file"
                              name="images"
                              accept="image/jpeg,image/png,image/webp,image/gif"
                              multiple
                              className="block w-full text-sm text-[var(--muted)] file:mr-3 file:rounded-lg file:border file:border-[var(--border)] file:bg-[var(--surface)] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[var(--foreground)]"
                            />
                            <span className="text-[11px] text-[var(--muted)]">
                              Up to 8 images, 5 MB each. Requires Supabase storage (
                              <code className="rounded bg-[var(--surface-muted)] px-1">
                                SUPABASE_SERVICE_ROLE_KEY
                              </code>
                              ).
                            </span>
                          </label>
                          <motion.button
                            type="submit"
                            whileHover={{ y: -1 }}
                            whileTap={{ scale: 0.97 }}
                            className="inline-flex items-center gap-1.5 self-start rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] shadow-sm transition hover:border-[var(--primary)]/40"
                          >
                            <PlusCircle className="h-4 w-4" />
                            Add document
                          </motion.button>
                        </form>
                      </div>
                    </SpotlightCard>
                  </FadeIn>
                </div>

                {docs.length === 0 ? (
                  <EmptyState
                    title="No documents yet"
                    body="Paste a note or upload a PDF above to start training the agent."
                  />
                ) : (
                  <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <AnimatePresence initial={false}>
                      {docs.map((d, i) => (
                        <motion.li
                          key={d.id}
                          layout
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ delay: i * 0.03 }}
                          className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)]/85 p-5 shadow-[var(--shadow-soft)] backdrop-blur-md"
                        >
                          <div className="mb-3 flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
                                {d.sourceType === "pdf" ? (
                                  <FileText className="h-4 w-4" />
                                ) : (
                                  <BookOpen className="h-4 w-4" />
                                )}
                              </span>
                              <div>
                                <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                                  {d.sourceType === "pdf" ? "PDF" : "Text note"}
                                </p>
                                <h3 className="truncate text-sm font-semibold">
                                  {d.title}
                                </h3>
                              </div>
                            </div>
                            <form action={actions.deleteKnowledgeForm}>
                              <input type="hidden" name="id" value={d.id} />
                              <button
                                type="submit"
                                className="inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-1 text-[11px] font-medium text-[var(--muted)] transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-500"
                              >
                                <Trash2 className="h-3 w-3" />
                                Delete
                              </button>
                            </form>
                          </div>
                          <p className="max-h-44 overflow-hidden whitespace-pre-wrap text-sm text-[var(--muted)]">
                            {d.content.length > 480
                              ? d.content.slice(0, 480) + "…"
                              : d.content}
                          </p>
                          {d.filePath ? (
                            <p className="mt-3 text-[11px] text-[var(--muted)]">
                              Stored: {d.filePath}
                            </p>
                          ) : null}
                          {d.imageCount > 0 ? (
                            <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                              <ImageIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              {d.imageCount} listing photo
                              {d.imageCount === 1 ? "" : "s"}
                            </p>
                          ) : null}
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                )}
              </motion.div>
            ) : null}

            {tab === "assistant" ? (
              <motion.div
                key="assistant"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col gap-5"
              >
                <div className="flex flex-col gap-1 rounded-3xl border border-[var(--border)] bg-[var(--surface)]/80 p-5 shadow-[var(--shadow-soft)] backdrop-blur-md">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    Visitor-facing
                  </p>
                  <h2 className="text-xl font-semibold tracking-tight">
                    <GradientText>How the AI talks</GradientText>
                  </h2>
                  <p className="text-sm text-[var(--muted)]">
                    Set tone, what to emphasize, what to avoid, and how to handle
                    edge cases. This is merged into the system prompt for{" "}
                    <strong className="text-[var(--foreground)]">text chat</strong>{" "}
                    and{" "}
                    <strong className="text-[var(--foreground)]">voice calls</strong>
                    , together with your knowledge base.{" "}
                    <strong className="text-[var(--foreground)]">Language</strong>{" "}
                    controls the visitor UI, AI replies, and voice session
                    language.
                  </p>
                </div>

                <FadeIn>
                  <SpotlightCard>
                    <form
                      action={actions.saveCustomerLocale}
                      className="flex flex-col gap-3 p-5"
                    >
                      <label className="flex flex-col gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                          Visitor language
                        </span>
                        <select
                          name="customerLocale"
                          defaultValue={customerLocale}
                          className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)]/40 transition focus:ring-2"
                        >
                          {CUSTOMER_LOCALE_OPTIONS.map((o) => (
                            <option key={o.code} value={o.code}>
                              {o.label} ({o.code})
                            </option>
                          ))}
                        </select>
                      </label>
                      <p className="text-[11px] text-[var(--muted)]">
                        Applies to the public chat and voice pages, AI responses,
                        and speech recognition for voice.
                      </p>
                      <motion.button
                        type="submit"
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        className="inline-flex items-center gap-2 self-start rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-5 py-2.5 text-sm font-semibold text-[var(--foreground)] shadow-sm transition hover:bg-[var(--surface)]"
                      >
                        Save language
                      </motion.button>
                    </form>
                  </SpotlightCard>
                </FadeIn>

                <FadeIn>
                  <SpotlightCard>
                    <form
                      action={actions.saveRealtimeVoice}
                      className="flex flex-col gap-3 p-5"
                    >
                      <label className="flex flex-col gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                          Voice for calls
                        </span>
                        <select
                          name="realtimeVoice"
                          defaultValue={realtimeVoice}
                          className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)]/40 transition focus:ring-2"
                        >
                          {OPENAI_REALTIME_VOICE_OPTIONS.map((voice) => (
                            <option key={voice.id} value={voice.id}>
                              {voice.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <p className="text-[11px] text-[var(--muted)]">
                        Used by OpenAI Realtime voice calls through your{" "}
                        <code className="rounded bg-[var(--surface-muted)] px-1">
                          OPENAI_API_KEY
                        </code>
                        .
                      </p>
                      <motion.button
                        type="submit"
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        className="inline-flex items-center gap-2 self-start rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-5 py-2.5 text-sm font-semibold text-[var(--foreground)] shadow-sm transition hover:bg-[var(--surface)]"
                      >
                        <Phone className="h-4 w-4" aria-hidden />
                        Save voice
                      </motion.button>
                    </form>
                  </SpotlightCard>
                </FadeIn>

                <FadeIn>
                  <SpotlightCard>
                    <form
                      action={actions.saveCustomerInstructions}
                      className="flex flex-col gap-4 p-5"
                    >
                      <label className="flex flex-col gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                          Instructions for customers
                        </span>
                        <textarea
                          name="customerInstructions"
                          defaultValue={customerInstructions}
                          rows={14}
                          placeholder={`Examples you can paste or adapt:

• Greet as "Team at Acme" and keep answers under 3 short paragraphs.
• We sell B2B analytics — never quote prices; offer a discovery call instead.
• If asked about competitors, stay neutral and highlight our integrations.
• Never promise same-day onboarding; say "typically within 5 business days."`}
                          className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm leading-relaxed text-[var(--foreground)] outline-none ring-[var(--primary)]/40 transition focus:ring-2"
                        />
                      </label>
                      <p className="text-[11px] text-[var(--muted)]">
                        Max ~12k characters. Leave blank to use only the default
                        agent behavior plus knowledge documents.
                      </p>
                      <motion.button
                        type="submit"
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        className="inline-flex items-center gap-2 self-start rounded-full bg-[linear-gradient(135deg,#6366f1,#8b5cf6)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_-12px_rgba(99,102,241,0.7)] transition hover:brightness-110"
                      >
                        <Bot className="h-4 w-4" aria-hidden />
                        Save instructions
                      </motion.button>
                    </form>
                  </SpotlightCard>
                </FadeIn>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      <MeetingDrawer
        open={drawerOpen}
        day={selectedDay}
        meetings={selectedDayMeetings}
        onClose={() => setDrawerOpen(false)}
        deleteAction={actions.deleteMeetingForm}
        updateMeetingForm={actions.updateMeetingForm}
      />
    </AuroraBackground>
  );
}

function StatCard({
  title,
  value,
  hint,
  gradient,
  delay = 0,
}: {
  title: string;
  value: number;
  hint: string;
  gradient: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 340, damping: 28 }}
      className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)]/85 p-5 shadow-[var(--shadow-soft)] backdrop-blur-md"
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br opacity-40 blur-2xl",
          gradient
        )}
      />
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          {title}
        </p>
        <p className="mt-2 text-3xl font-semibold tracking-tight">
          <CountUp value={value} />
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>
      </div>
    </motion.div>
  );
}

function OverviewHero({
  nextMeeting,
  latestMeeting,
  onOpenMeeting,
}: {
  nextMeeting: SerializedMeeting | null;
  latestMeeting: SerializedMeeting | null;
  onOpenMeeting: (m: SerializedMeeting) => void;
}) {
  return (
    <FadeIn>
      <div className="relative overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--surface)]/85 shadow-[var(--shadow-elevated)] backdrop-blur-md">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 15% 20%, rgba(99,102,241,0.22), transparent 55%), radial-gradient(circle at 85% 10%, rgba(168,85,247,0.22), transparent 60%), radial-gradient(circle at 50% 100%, rgba(34,211,238,0.18), transparent 60%)",
          }}
        />
        <div className="relative grid grid-cols-1 gap-5 p-6 md:grid-cols-[1.4fr_1fr] md:gap-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
              <ShinyText>Welcome back</ShinyText>
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
              <GradientText animated>Lead/Booking Agent dashboard</GradientText>
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--muted)]">
              Leads, meetings, and knowledge your agent captures — in one place.
              Use the calendar to see every meeting at a glance; tap a day for
              full details.
            </p>
          </div>
          <div className="flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
              Next meeting
            </p>
            {nextMeeting ? (
              <button
                type="button"
                onClick={() => onOpenMeeting(nextMeeting)}
                className="flex flex-col gap-2 rounded-xl text-left transition hover:bg-[var(--surface-muted)]/60"
              >
                <p className="break-words text-base font-semibold tracking-tight">
                  {nextMeeting.title}
                </p>
                <p className="text-sm text-[var(--muted)]">
                  <span className="font-medium text-[var(--foreground)]">
                    Start:
                  </span>{" "}
                  {formatDashboardDateTime(nextMeeting.startAt)}
                  <br />
                  <span className="font-medium text-[var(--foreground)]">
                    End:
                  </span>{" "}
                  {formatDashboardDateTime(nextMeeting.endAt)}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                  {nextMeeting.meetingType ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--primary)]/10 px-2 py-0.5 font-medium text-[var(--primary)]">
                      {nextMeeting.meetingType === "phone" ? (
                        <Phone className="h-3 w-3" />
                      ) : (
                        <Video className="h-3 w-3" />
                      )}
                      {nextMeeting.meetingType.replace("_", " ")}
                    </span>
                  ) : null}
                  {nextMeeting.attendeeName ? (
                    <span className="break-words">{nextMeeting.attendeeName}</span>
                  ) : null}
                </div>
                {nextMeeting.locationDetail ? (
                  <p className="line-clamp-2 break-all text-xs text-[var(--primary)]">
                    {nextMeeting.locationDetail}
                  </p>
                ) : null}
                <span className="text-[11px] font-medium text-[var(--primary)]">
                  View full details →
                </span>
              </button>
            ) : !nextMeeting && latestMeeting ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-[var(--muted)]">
                  No upcoming or in-progress slot. Latest recorded booking:
                </p>
                <button
                  type="button"
                  onClick={() => onOpenMeeting(latestMeeting)}
                  className="flex flex-col gap-1 rounded-xl text-left transition hover:bg-[var(--surface-muted)]/60"
                >
                  <p className="break-words text-sm font-semibold">
                    {latestMeeting.title}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {formatDashboardDateTime(latestMeeting.startAt)}
                  </p>
                  <span className="text-[11px] font-medium text-[var(--primary)]">
                    Open details →
                  </span>
                </button>
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">
                No meetings yet. New bookings will land here and on the calendar.
              </p>
            )}
          </div>
        </div>
      </div>
    </FadeIn>
  );
}

function QuickActionIcon({ Icon }: { Icon: typeof BookOpen }) {
  return <Icon className="h-4 w-4 shrink-0 text-[var(--primary)]" aria-hidden />;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)]/50 px-6 py-12 text-center"
    >
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="max-w-md text-sm text-[var(--muted)]">{body}</p>
    </motion.div>
  );
}

function UpcomingMeetingsList({
  meetings,
  onSelect,
}: {
  meetings: SerializedMeeting[];
  onSelect: (m: SerializedMeeting) => void;
}) {
  const upcoming = useMemo(() => {
    const now = Date.now();
    return meetings
      .filter((m) => new Date(m.endAt).getTime() >= now)
      .sort(
        (a, b) =>
          new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
      )
      .slice(0, 8);
  }, [meetings]);
  if (upcoming.length === 0) return null;
  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)]/80 p-4 shadow-[var(--shadow-soft)] backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight">
          Open & upcoming
        </h3>
        <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
          next {upcoming.length}
        </span>
      </div>
      <ul className="flex flex-col divide-y divide-[var(--border)]">
        {upcoming.map((m, i) => {
          const start = new Date(m.startAt);
          return (
            <motion.li
              key={m.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <button
                type="button"
                onClick={() => onSelect(m)}
                className="flex w-full items-center gap-3 py-3 text-left transition hover:bg-[var(--surface-muted)]/60 hover:pl-1"
              >
                <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
                  <span className="text-[10px] font-semibold uppercase tracking-wide">
                    {start.toLocaleString(undefined, { month: "short" })}
                  </span>
                  <span className="text-sm font-bold tabular-nums leading-none">
                    {start.getDate()}
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium">{m.title}</p>
                  <p className="break-words text-xs text-[var(--muted)]">
                    {start.toLocaleTimeString(undefined, {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                    {m.attendeeName ? ` · ${m.attendeeName}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] text-[var(--muted)]">
                  {formatRelativeOrAbsolute(m.startAt)}
                </span>
              </button>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
