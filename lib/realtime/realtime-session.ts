import { buildKnowledgeContext } from "@/lib/knowledge";
import {
  getAgentLocale,
  getCustomerResponseInstructions,
} from "@/lib/customer-ai-settings";
import { localeLabel, normalizeCustomerLocale } from "@/lib/locales";
import { REALTIME_SESSION_TOOLS } from "@/lib/realtime/realtime-tools";

export type RealtimeCallSessionOptions = {
  mic: "near_field" | "far_field";
  vad: "semantic" | "server";
  voice: string;
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
  locale: string
): string {
  const code = normalizeCustomerLocale(locale);
  const langName = localeLabel(code);
  const owner = ownerInstructions.trim();
  const ownerSection = owner
    ? `\n\n## Owner instructions (tone, offers, boundaries — follow closely)\n${owner}`
    : "";
  const langSection = `\n\n## Language\nSpeak and respond only in ${langName} (ISO 639-1: ${code}). All spoken output and reasoning you express to the user must be in this language.`;
  return `You are a warm, professional AI lead and booking assistant on a live voice phone call (same role as the text chat).
- Use the KNOWLEDGE BASE when it helps; otherwise say you will pass details to the team.
- Be concise and natural for speech. Ask one focused question at a time when qualifying.
- When the visitor clearly shares a real name, email, and intent, you MUST call the captureLead tool once to save them for the owner dashboard.
- When the visitor confirms a specific meeting time window AND how to connect (Google Meet, Zoom link, or phone number), you MUST call bookMeeting with accurate ISO-8601 start/end times and put the link or phone in locationDetail.
- The owner sees leads and meetings only after these tools succeed — do not only say you booked; call the tools.
- Never invent personal data, meetings, or policies not grounded in the knowledge base.

## Knowledge base
${kb}${ownerSection}${langSection}`;
}

/**
 * JSON string for the `session` multipart field on `POST /v1/realtime/calls`.
 * @see https://developers.openai.com/api/docs/guides/realtime-webrtc
 */
export async function buildRealtimeCallSessionJson(
  opts: RealtimeCallSessionOptions
): Promise<string> {
  const model =
    process.env.OPENAI_REALTIME_MODEL?.trim() || "gpt-realtime";
  const [kb, ownerInstructions, sessionLocale] = await Promise.all([
    buildKnowledgeContext(),
    getCustomerResponseInstructions(),
    getAgentLocale(),
  ]);
  const locale = normalizeCustomerLocale(sessionLocale);
  const instructions = buildVoiceInstructions(kb, ownerInstructions, locale);

  const input: Record<string, unknown> = {
    noise_reduction: { type: opts.mic },
    turn_detection: turnDetection(opts.vad),
  };

  const transcribeModel =
    process.env.OPENAI_REALTIME_TRANSCRIBE_MODEL?.trim() ||
    "gpt-4o-mini-transcribe";
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
        voice: opts.voice,
      },
    },
  };

  return JSON.stringify(session);
}
