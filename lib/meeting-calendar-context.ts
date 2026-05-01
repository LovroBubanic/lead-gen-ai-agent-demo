import { prisma } from "@/lib/prisma";

/** Include meetings that may still be in progress from the previous day. */
const LOOKBACK_MS = 24 * 60 * 60 * 1000;
const MAX_MEETINGS = 120;

/**
 * Text block listing existing bookings for the agent (chat + voice).
 * Times are ISO-8601 UTC so the model can compare with visitor proposals.
 */
export async function buildMeetingCalendarContextForAgent(): Promise<string> {
  try {
    const cutoff = new Date(Date.now() - LOOKBACK_MS);
    const meetings = await prisma.meeting.findMany({
      where: { endAt: { gte: cutoff } },
      orderBy: { startAt: "asc" },
      take: MAX_MEETINGS,
      select: { id: true, title: true, startAt: true, endAt: true },
    });
    if (meetings.length === 0) {
      return "No upcoming or in-progress bookings are stored yet. You may propose reasonable slots; the server still rejects overlaps if two visitors race for the same instant.";
    }
    const lines = meetings.map((m) => {
      const safeTitle = m.title.replace(/"/g, "'");
      return `- ${m.startAt.toISOString()} → ${m.endAt.toISOString()} (UTC) — "${safeTitle}" [id: ${m.id}]`;
    });
    return [
      "These intervals are already booked (UTC). Two ranges conflict if they overlap (one starts before the other ends).",
      "Never call bookMeeting for a window that overlaps any row below; offer a free alternative instead.",
      ...lines,
    ].join("\n");
  } catch {
    return "Calendar could not be loaded from the database. Do not promise a slot is free without double-checking; bookMeeting will still reject overlaps when the calendar is available.";
  }
}
