import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseBookMeetingIsoToUtc } from "@/lib/meeting-datetime";
import { asImagePathList, publicListingImageUrl } from "@/lib/listing-images";

export const captureLeadInputSchema = z.object({
  name: z.string().describe("Visitor's name"),
  email: z.string().email().describe("Email address"),
  intent: z.string().describe("What they want in one sentence"),
  conversationSummary: z
    .string()
    .describe(
      "2–4 sentences for the owner. Use today's actual date when referring to 'today'; do not invent random past years."
    ),
});

export const bookMeetingInputSchema = z.object({
  title: z.string().describe("Short meeting title, e.g. Intro call with Acme"),
  startAtIso: z
    .string()
    .describe(
      "Start as ISO-8601. Prefer an explicit offset (2026-05-05T15:00:00+02:00) or Z (UTC). If you omit the offset, the server treats the wall time as BOOKING_INPUT_TIMEZONE (default UTC)."
    ),
  endAtIso: z
    .string()
    .describe(
      "End as ISO-8601 with same rules as startAtIso (offset or Z strongly recommended)."
    ),
  attendeeName: z.string().optional(),
  attendeeEmail: z.string().email().optional(),
  notes: z.string().optional().describe("Optional internal notes"),
  meetingType: z
    .enum(["google_meet", "zoom", "phone", "other"])
    .optional()
    .describe(
      "How the call happens: Google Meet, Zoom, phone, or other (stored for the owner)"
    ),
  locationDetail: z
    .string()
    .optional()
    .describe(
      "Meeting link, Zoom URL, or phone number — whatever the visitor confirmed"
    ),
});

export const showListingImageInputSchema = z.object({
  knowledgeDocumentId: z
    .string()
    .describe(
      "The knowledge document id for the property listing (shown in the knowledge base as Listing ID for photos)"
    ),
  imageIndex: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Which photo: 0 for the first, 1 for the second, etc. Default 0"),
});

export type ShowListingImageInput = z.infer<typeof showListingImageInputSchema>;
export type CaptureLeadInput = z.infer<typeof captureLeadInputSchema>;
export type BookMeetingInput = z.infer<typeof bookMeetingInputSchema>;

const MAX_LEAD_SUMMARY_FROM_BOOKING = 12_000;

/** Dashboard lead row so bookings show under Leads / Recent leads (same DB list as captureLead). */
function leadDataFromBooking(
  input: BookMeetingInput,
  meetingId: string,
  startAt: Date,
  endAt: Date
): { name: string | null; email: string | null; intent: string; summary: string } {
  const name =
    input.attendeeName?.trim() ||
    input.title.trim().slice(0, 200) ||
    "Visitor (booked)";
  const email = input.attendeeEmail?.trim() || null;
  const intent = `Scheduled booking: ${input.title}`.slice(0, 500);
  const lines = [
    "Booked via AI assistant (chat or voice call).",
    `Meeting ID: ${meetingId}`,
    `Title: ${input.title}`,
    `Start (UTC): ${startAt.toISOString()}`,
    `End (UTC): ${endAt.toISOString()}`,
  ];
  if (input.meetingType) {
    lines.push(`Connection: ${input.meetingType}`);
  }
  if (input.locationDetail?.trim()) {
    lines.push(`Location / link: ${input.locationDetail.trim()}`);
  }
  if (input.notes?.trim()) {
    lines.push(`Notes: ${input.notes.trim()}`);
  }
  let summary = lines.join("\n");
  if (summary.length > MAX_LEAD_SUMMARY_FROM_BOOKING) {
    summary = summary.slice(0, MAX_LEAD_SUMMARY_FROM_BOOKING);
  }
  return { name, email, intent, summary };
}

export async function executeCaptureLead(
  input: CaptureLeadInput
): Promise<{ saved: true }> {
  await prisma.lead.create({
    data: {
      name: input.name,
      email: input.email,
      intent: input.intent,
      summary: input.conversationSummary,
    },
  });
  return { saved: true };
}

export async function executeBookMeeting(input: BookMeetingInput): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const startAt = parseBookMeetingIsoToUtc(input.startAtIso);
  const endAt = parseBookMeetingIsoToUtc(input.endAtIso);
  if (!startAt || !endAt) {
    return { ok: false, error: "Invalid datetime" };
  }
  if (endAt <= startAt) {
    return { ok: false, error: "End must be after start" };
  }
  try {
    return await prisma.$transaction(
      async (tx) => {
        const conflict = await tx.meeting.findFirst({
          where: {
            AND: [{ startAt: { lt: endAt } }, { endAt: { gt: startAt } }],
          },
          select: {
            title: true,
            startAt: true,
            endAt: true,
          },
        });
        if (conflict) {
          return {
            ok: false as const,
            error: `That time overlaps an existing booking "${conflict.title}" (${conflict.startAt.toISOString()}–${conflict.endAt.toISOString()} UTC). Offer a different slot that does not overlap the owner calendar.`,
          };
        }
        const meeting = await tx.meeting.create({
          data: {
            title: input.title,
            startAt,
            endAt,
            attendeeName: input.attendeeName,
            attendeeEmail: input.attendeeEmail,
            notes: input.notes,
            meetingType: input.meetingType ?? null,
            locationDetail: input.locationDetail ?? null,
            bookedByAgent: true,
          },
        });
        const leadData = leadDataFromBooking(
          input,
          meeting.id,
          startAt,
          endAt
        );
        await tx.lead.create({ data: leadData });
        return { ok: true as const };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 10_000,
      }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Booking failed";
    return {
      ok: false,
      error: `Could not confirm the booking (${msg}). Try a slightly different time.`,
    };
  }
}

export async function executeShowListingImage(
  input: ShowListingImageInput
): Promise<{
  ok: true;
  imageUrl: string;
  title: string;
  imageIndex: number;
  totalImages: number;
} | { ok: false; error: string }> {
  const doc = await prisma.knowledgeDocument.findUnique({
    where: { id: input.knowledgeDocumentId },
  });
  if (!doc) {
    return { ok: false, error: "Listing document not found." };
  }
  const paths = asImagePathList(doc.imagePaths as Prisma.JsonValue | undefined);
  const idx = input.imageIndex ?? 0;
  if (paths.length === 0) {
    return {
      ok: false,
      error: "This knowledge entry has no listing photos attached.",
    };
  }
  if (idx < 0 || idx >= paths.length) {
    return {
      ok: false,
      error: `No photo at index ${idx}. This listing has ${paths.length} image(s) (indices 0–${paths.length - 1}).`,
    };
  }
  const raw = paths[idx];
  const imageUrl = publicListingImageUrl(doc.id, idx, raw);
  return {
    ok: true,
    imageUrl,
    title: doc.title,
    imageIndex: idx,
    totalImages: paths.length,
  };
}

/** Run by name with JSON arguments string (Realtime or HTTP). */
export async function runAgentToolByName(
  name: string,
  argumentsJson: string
): Promise<unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(argumentsJson) as unknown;
  } catch {
    return { ok: false, error: "Invalid JSON arguments" };
  }
  if (name === "captureLead") {
    const r = captureLeadInputSchema.safeParse(parsed);
    if (!r.success) {
      return { ok: false, error: r.error.flatten() };
    }
    return executeCaptureLead(r.data);
  }
  if (name === "bookMeeting") {
    const r = bookMeetingInputSchema.safeParse(parsed);
    if (!r.success) {
      return { ok: false, error: r.error.flatten() };
    }
    return executeBookMeeting(r.data);
  }
  if (name === "showListingImage") {
    const r = showListingImageInputSchema.safeParse(parsed);
    if (!r.success) {
      return { ok: false, error: r.error.flatten() };
    }
    return executeShowListingImage(r.data);
  }
  return { ok: false, error: `Unknown tool: ${name}` };
}
