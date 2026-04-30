/**
 * Optional IANA zone (e.g. Europe/Zagreb) baked into the client bundle via
 * `NEXT_PUBLIC_DASHBOARD_TIMEZONE`. If unset, the viewer's local zone is used.
 */
function dashboardTimeZone(): string | undefined {
  const z =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_DASHBOARD_TIMEZONE?.trim()
      : undefined;
  return z && z.length > 0 ? z : undefined;
}

/** Full date+time for owner dashboard (leads, meetings, copy export). */
export function formatDashboardDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Invalid date";
  const tz = dashboardTimeZone();
  return d.toLocaleString(undefined, {
    timeZone: tz,
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

/** Short relative label for recent rows; falls back to absolute when very old/far. */
export function formatRelativeOrAbsolute(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = then - now;
  const abs = Math.abs(diff);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (abs >= 45 * day) {
    return formatDashboardDateTime(iso);
  }
  if (abs < minute) return diff >= 0 ? "in a moment" : "just now";
  if (abs < hour) {
    const m = Math.round(abs / minute);
    return diff >= 0 ? `in ${m}m` : `${m}m ago`;
  }
  if (abs < day) {
    const h = Math.round(abs / hour);
    return diff >= 0 ? `in ${h}h` : `${h}h ago`;
  }
  const d = Math.round(abs / day);
  return diff >= 0 ? `in ${d}d` : `${d}d ago`;
}
