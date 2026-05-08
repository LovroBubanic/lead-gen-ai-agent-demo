export const VISITOR_PALETTE_IDS = [
  "default",
  "ocean",
  "forest",
  "sunset",
  "midnight",
] as const;

export type VisitorPaletteId = (typeof VISITOR_PALETTE_IDS)[number];

export const VISITOR_PALETTE_OPTIONS: {
  id: VisitorPaletteId;
  label: string;
  hint: string;
}[] = [
  { id: "default", label: "Charcoal", hint: "Neutral stone for chat and voice" },
  { id: "ocean", label: "Steel", hint: "Cool gray zinc accents" },
  { id: "forest", label: "Forest", hint: "Emerald and sage" },
  { id: "sunset", label: "Sunset", hint: "Amber and warm orange" },
  { id: "midnight", label: "Midnight", hint: "Deep warm charcoal" },
];

const ALLOWED = new Set<string>(VISITOR_PALETTE_IDS);

export function normalizeVisitorPalette(
  raw: string | null | undefined
): VisitorPaletteId {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return ALLOWED.has(s) ? (s as VisitorPaletteId) : "default";
}
