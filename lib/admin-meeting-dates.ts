/** Local calendar day key (YYYY-MM-DD) for grouping meetings in the owner UI. */
export function toDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function startOfMonthContaining(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Month to show first: soonest not-yet-ended meeting, else latest past meeting, else today. */
export function defaultOwnerCalendarMonth(
  meetings: { startAt: string; endAt: string }[]
): Date {
  if (meetings.length === 0) return startOfMonthContaining(new Date());
  const now = Date.now();
  const activeOrUpcoming = meetings.filter(
    (m) => new Date(m.endAt).getTime() >= now
  );
  if (activeOrUpcoming.length > 0) {
    const anchor = [...activeOrUpcoming].sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    )[0]!;
    return startOfMonthContaining(new Date(anchor.startAt));
  }
  const latestPast = [...meetings].sort(
    (a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime()
  )[0]!;
  return startOfMonthContaining(new Date(latestPast.startAt));
}
