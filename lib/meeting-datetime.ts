import "server-only";

import { toDate } from "date-fns-tz";

/**
 * When the model sends ISO without `Z` or `±hh:mm`, we treat it as **wall time**
 * in this IANA zone (e.g. Europe/Zagreb). On Vercel the Node default is UTC, so
 * without this env naive strings would be parsed as UTC wall clock — often wrong
 * for visitor-local bookings. Default `UTC` keeps previous behavior.
 */
function bookingInputTimeZone(): string {
  const z = process.env.BOOKING_INPUT_TIMEZONE?.trim();
  return z && z.length > 0 ? z : "UTC";
}

/**
 * Parse `bookMeeting` start/end strings into UTC `Date` for Prisma.
 * - Strings with `Z` or numeric offset use normal JS parsing.
 * - Naive `YYYY-MM-DDTHH:mm[:ss][.fff]` use `BOOKING_INPUT_TIMEZONE` as the wall clock.
 */
export function parseBookMeetingIsoToUtc(iso: string): Date | null {
  const s = iso.trim();
  if (!s) return null;
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = toDate(s, { timeZone: bookingInputTimeZone() });
  return Number.isNaN(d.getTime()) ? null : d;
}
