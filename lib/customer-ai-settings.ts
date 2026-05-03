import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeCustomerLocale } from "@/lib/locales";
import { normalizeOpenAIRealtimeVoice } from "@/lib/openai-realtime-voices";
import type { VisitorPaletteId } from "@/lib/visitor-ui-palettes";
import { normalizeVisitorPalette } from "@/lib/visitor-ui-palettes";

export const AGENT_SETTINGS_ID = "global" as const;

/**
 * Load owner-written chat/voice instructions.
 * Uses raw SQL so it works even when the dev server is holding an older Prisma
 * engine DLL and `prisma generate` cannot complete until the server stops.
 */
export async function getCustomerResponseInstructions(): Promise<string> {
  try {
    const rows = await prisma.$queryRaw<Array<{ customerInstructions: string }>>(
      Prisma.sql`SELECT "customerInstructions" FROM "AgentSettings" WHERE "id" = ${AGENT_SETTINGS_ID} LIMIT 1`
    );
    const v = rows[0]?.customerInstructions;
    return typeof v === "string" ? v.trim() : "";
  } catch {
    return "";
  }
}

/**
 * Load customer-facing locale (ISO 639-1). Falls back to `en` if missing or invalid.
 * Uses raw SQL for the same reason as getCustomerResponseInstructions.
 */
export async function getAgentLocale(): Promise<string> {
  try {
    const rows = await prisma.$queryRaw<Array<{ customerLocale: string | null }>>(
      Prisma.sql`SELECT "customerLocale" FROM "AgentSettings" WHERE "id" = ${AGENT_SETTINGS_ID} LIMIT 1`
    );
    const v = rows[0]?.customerLocale;
    return normalizeCustomerLocale(typeof v === "string" ? v : null);
  } catch {
    return normalizeCustomerLocale(null);
  }
}

/**
 * Load the OpenAI Realtime voice selected by the owner. Falls back to env/default
 * while older databases are missing the column.
 */
export async function getAgentRealtimeVoice(): Promise<string> {
  try {
    const rows = await prisma.$queryRaw<Array<{ realtimeVoice: string | null }>>(
      Prisma.sql`SELECT "realtimeVoice" FROM "AgentSettings" WHERE "id" = ${AGENT_SETTINGS_ID} LIMIT 1`
    );
    return normalizeOpenAIRealtimeVoice(
      rows[0]?.realtimeVoice ?? process.env.OPENAI_REALTIME_VOICE
    );
  } catch {
    return normalizeOpenAIRealtimeVoice(process.env.OPENAI_REALTIME_VOICE);
  }
}

function normalizeDashboardTheme(
  v: string | null | undefined
): "light" | "dark" {
  if (v === "dark" || v === "light") return v;
  return "light";
}

/**
 * Owner dashboard light/dark preference.
 */
export async function getDashboardTheme(): Promise<"light" | "dark"> {
  try {
    const rows = await prisma.$queryRaw<Array<{ dashboardTheme: string | null }>>(
      Prisma.sql`SELECT "dashboardTheme" FROM "AgentSettings" WHERE "id" = ${AGENT_SETTINGS_ID} LIMIT 1`
    );
    return normalizeDashboardTheme(rows[0]?.dashboardTheme ?? null);
  } catch {
    return "light";
  }
}

/**
 * Public chat/call color palette id.
 */
export async function getVisitorUiPalette(): Promise<VisitorPaletteId> {
  try {
    const rows = await prisma.$queryRaw<Array<{ visitorUiPalette: string | null }>>(
      Prisma.sql`SELECT "visitorUiPalette" FROM "AgentSettings" WHERE "id" = ${AGENT_SETTINGS_ID} LIMIT 1`
    );
    return normalizeVisitorPalette(rows[0]?.visitorUiPalette ?? null);
  } catch {
    return "default";
  }
}
