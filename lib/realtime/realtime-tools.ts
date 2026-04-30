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
            "2–4 sentences summarizing the conversation for the owner",
        },
      },
      required: ["name", "email", "intent", "conversationSummary"],
    },
  },
  {
    type: "function" as const,
    name: "bookMeeting",
    description:
      "Save a calendar booking after the visitor agrees to a concrete date, time, and how to connect (Google Meet, Zoom, or phone). Use ISO-8601 datetimes with timezone when possible. Store any link or phone number they confirmed in locationDetail.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Short meeting title, e.g. Intro call with Acme",
        },
        startAtIso: {
          type: "string",
          description: "Start time as ISO-8601 datetime",
        },
        endAtIso: {
          type: "string",
          description: "End time as ISO-8601 datetime",
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
