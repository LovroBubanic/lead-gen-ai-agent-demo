/**
 * Tool definitions for OpenAI Realtime `session.tools` (JSON Schema parameters).
 * Must stay aligned with `lib/agent-tools.ts` and `/api/chat` tools.
 */
export const REALTIME_SESSION_TOOLS = [
  {
    type: "function" as const,
    name: "captureLead",
    description:
      "Save a sales lead when the visitor has shared their real name and email and you understand what they want. Call at most once per clear opt-in.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Visitor's name" },
        email: { type: "string", description: "Email address" },
        intent: { type: "string", description: "What they want in one sentence" },
        conversationSummary: {
          type: "string",
          description:
            "2–4 sentences for the owner; use the real session date when mentioning 'today', never random past years.",
        },
      },
      required: ["name", "email", "intent", "conversationSummary"],
    },
  },
  {
    type: "function" as const,
    name: "bookMeeting",
    description:
      "Save a calendar booking after the visitor agrees to a concrete date, time, and how to connect. Also creates a Leads dashboard entry for the owner. Use ISO-8601 start/end with timezone offset (+02:00) or Z; naive wall times use server BOOKING_INPUT_TIMEZONE (default UTC). Put Meet/Zoom link or phone in locationDetail. Prefer attendeeName and attendeeEmail when known. Do not use a window that overlaps any interval in the owner calendar in your instructions; the server rejects overlaps.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Short meeting title, e.g. Intro call with Acme",
        },
        startAtIso: {
          type: "string",
          description:
            "Start as ISO-8601 with offset (recommended), e.g. 2026-05-05T15:00:00+02:00",
        },
        endAtIso: {
          type: "string",
          description:
            "End as ISO-8601 with offset (recommended), same rules as startAtIso",
        },
        attendeeName: { type: "string", description: "Guest name" },
        attendeeEmail: { type: "string", description: "Guest email" },
        notes: { type: "string", description: "Optional internal notes" },
        meetingType: {
          type: "string",
          enum: ["google_meet", "zoom", "phone", "other"],
          description:
            "google_meet | zoom | phone | other — connection method agreed with the visitor",
        },
        locationDetail: {
          type: "string",
          description:
            "Paste the Meet link, Zoom link, or phone number the visitor will use",
        },
      },
      required: ["title", "startAtIso", "endAtIso"],
    },
  },
  {
    type: "function" as const,
    name: "showListingImage",
    description:
      "Show a property listing photo in the chat when the visitor asks to see the home, photos, or a room. Use knowledgeDocumentId from the knowledge base. imageIndex 0 is the first photo.",
    parameters: {
      type: "object",
      properties: {
        knowledgeDocumentId: {
          type: "string",
          description: "Knowledge document id for the listing (from the knowledge base)",
        },
        imageIndex: {
          type: "integer",
          description: "0-based photo index; default 0",
        },
      },
      required: ["knowledgeDocumentId"],
    },
  },
];
