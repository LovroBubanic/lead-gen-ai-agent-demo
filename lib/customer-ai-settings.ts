import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeCustomerLocale } from "@/lib/locales";

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
