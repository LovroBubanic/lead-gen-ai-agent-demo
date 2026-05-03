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
  { id: "default", label: "Indigo aurora", hint: "Original gradient brand look" },
  { id: "ocean", label: "Ocean", hint: "Teal and cyan" },
  { id: "forest", label: "Forest", hint: "Emerald and sage" },
  { id: "sunset", label: "Sunset", hint: "Rose and amber warmth" },
  { id: "midnight", label: "Midnight", hint: "Deep violet and slate" },
];

const ALLOWED = new Set<string>(VISITOR_PALETTE_IDS);

export function normalizeVisitorPalette(
  raw: string | null | undefined
): VisitorPaletteId {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return ALLOWED.has(s) ? (s as VisitorPaletteId) : "default";
}
