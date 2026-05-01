export const DEFAULT_REALTIME_VOICE = "marin" as const;

export const OPENAI_REALTIME_VOICE_OPTIONS = [
  { id: "marin", label: "Marin" },
  { id: "cedar", label: "Cedar" },
  { id: "alloy", label: "Alloy" },
  { id: "ash", label: "Ash" },
  { id: "ballad", label: "Ballad" },
  { id: "coral", label: "Coral" },
  { id: "sage", label: "Sage" },
  { id: "verse", label: "Verse" },
] as const;

export type OpenAIRealtimeVoice =
  (typeof OPENAI_REALTIME_VOICE_OPTIONS)[number]["id"];

const VOICE_IDS = new Set<string>(
  OPENAI_REALTIME_VOICE_OPTIONS.map((voice) => voice.id)
);

export function normalizeOpenAIRealtimeVoice(
  value: string | null | undefined
): OpenAIRealtimeVoice {
  const normalized = value?.trim().toLowerCase();
  return VOICE_IDS.has(normalized ?? "")
    ? (normalized as OpenAIRealtimeVoice)
    : DEFAULT_REALTIME_VOICE;
}
