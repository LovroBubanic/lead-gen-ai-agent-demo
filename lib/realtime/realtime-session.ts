import { buildKnowledgeContext } from "@/lib/knowledge";
import { buildMeetingCalendarContextForAgent } from "@/lib/meeting-calendar-context";
import {
  getAgentLocale,
  getAgentRealtimeVoice,
  getCustomerResponseInstructions,
} from "@/lib/customer-ai-settings";
import { localeLabel, normalizeCustomerLocale } from "@/lib/locales";
import { REALTIME_SESSION_TOOLS } from "@/lib/realtime/realtime-tools";

export type RealtimeCallSessionOptions = {
  mic: "near_field" | "far_field";
  vad: "semantic" | "server";
  voice?: string;
};

function turnDetection(vad: "semantic" | "server") {
  if (vad === "semantic") {
    return {
      type: "semantic_vad" as const,
      eagerness: "auto" as const,
      create_response: true,
      interrupt_response: true,
    };
  }
  return {
    type: "server_vad" as const,
    threshold: 0.48,
    prefix_padding_ms: 280,
    silence_duration_ms: 520,
    create_response: true,
    interrupt_response: true,
  };
}

function buildVoiceInstructions(
  kb: string,
  ownerInstructions: string,
  locale: string,
  calendarBlock: string
): string {
  const code = normalizeCustomerLocale(locale);
  const langName = localeLabel(code);
  const owner = ownerInstructions.trim();
  const ownerSection = owner
    ? `\n\n## Owner instructions (tone, offers, boundaries)\n${owner}\n- Follow owner tone, policies, and facts, but every word you speak aloud to the visitor must be in ${langName} (ISO 639-1: ${code}). If any example greeting or phrase here is written in another language, translate it into ${langName} for speech while keeping the same intent.`
    : "";
  const calendarSection = `\n\n## Owner calendar — already booked (never double-book)\n${calendarBlock}\n- Compare proposed times in UTC or convert carefully. Never book a slot that overlaps an existing interval above.\n- If the visitor's choice conflicts, apologize and offer alternatives that do not overlap.\n- bookMeeting rejects overlaps server-side; if it fails, choose a different time and call bookMeeting again.`;
  const langBlock = `## Visitor language (highest priority)\nYou MUST speak only in ${langName} (ISO 639-1: ${code}) for the entire call — greeting, explanations, apologies, and read-aloud content. This overrides the language of text in the knowledge base, calendar titles, or owner instructions: treat those as reference content, not as a cue to switch spoken language. Do not switch spoken language unless the visitor clearly switches first.`;
  return `You are a warm, professional AI lead and booking assistant on a live voice phone call (same role as the text chat).
- Use the KNOWLEDGE BASE when it helps; otherwise say you will pass details to the team.
- At the start of every new call, greet in ${langName} only with a short hello before asking how you can help.
- Be concise and natural for speech. Ask one focused question at a time when qualifying.
- When the visitor clearly shares a real name, email, and intent, you MUST call the captureLead tool once to save them for the owner dashboard.
- When the visitor confirms a specific meeting time window AND how to connect (Google Meet, Zoom link, or phone number), you MUST call bookMeeting with ISO-8601 start/end datetimes that include a timezone offset from the visitor's zone (e.g. ...+02:00) or Z for UTC — never invent past years — and put the link or phone in locationDetail. Always respect the owner calendar: never book over an existing slot. Calling bookMeeting saves the calendar entry and also adds a row under Leads for the owner (include attendeeName and attendeeEmail when known).
- The owner sees leads and meetings only after these tools succeed — do not only say you booked; call the tools.
- Never invent personal data, meetings, or policies not grounded in the knowledge base.

${langBlock}

## Knowledge base
${kb}${calendarSection}${ownerSection}`;
}

/**
 * JSON string for the `session` multipart field on `POST /v1/realtime/calls`.
 * @see https://developers.openai.com/api/docs/guides/realtime-webrtc
 */
export async function buildRealtimeCallSessionJson(
  opts: RealtimeCallSessionOptions
): Promise<string> {
  const model =
    process.env.OPENAI_REALTIME_MODEL?.trim() || "gpt-realtime-2.1";
  const [kb, ownerInstructions, sessionLocale, savedVoice, calendarBlock] =
    await Promise.all([
      buildKnowledgeContext(),
      getCustomerResponseInstructions(),
      getAgentLocale(),
      getAgentRealtimeVoice(),
      buildMeetingCalendarContextForAgent(),
    ]);
  const locale = normalizeCustomerLocale(sessionLocale);
  const instructions = buildVoiceInstructions(
    kb,
    ownerInstructions,
    locale,
    calendarBlock
  );
  const voice = opts.voice ?? savedVoice;

  const input: Record<string, unknown> = {
    noise_reduction: { type: opts.mic },
    turn_detection: turnDetection(opts.vad),
  };

  const transcribeModel =
    process.env.OPENAI_REALTIME_TRANSCRIBE_MODEL?.trim() ||
    "gpt-transcribe";
  if (process.env.OPENAI_REALTIME_INPUT_TRANSCRIPTION !== "0") {
    input.transcription = {
      model: transcribeModel,
      language: locale,
    };
  }

  const session = {
    type: "realtime" as const,
    model,
    instructions,
    tools: REALTIME_SESSION_TOOLS,
    tool_choice: "auto" as const,
    audio: {
      input,
      output: {
        voice,
      },
    },
  };

  return JSON.stringify(session);
}
