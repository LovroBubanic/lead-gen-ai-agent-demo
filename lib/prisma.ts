import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

/** libsql resolves `file:` relative to cwd; Prisma CLI resolves relative to prisma/. */
function toLibsqlFileUrl(databaseUrl: string): string {
  if (!databaseUrl.startsWith("file:")) return databaseUrl;
  const rest = databaseUrl.slice("file:".length).replace(/\\/g, "/");
  if (rest.startsWith("//") || /^\/[A-Za-z]:\//.test(rest) || /^[A-Za-z]:\//.test(rest)) {
    return databaseUrl;
  }
  const rel = rest.replace(/^\.\//, "");
  const abs = path.join(process.cwd(), "prisma", rel);
  return pathToFileURL(abs).href;
}

function createClientInstance(): PrismaClient {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL is not set.");
  }

  const log =
    process.env.NODE_ENV === "development" ? (["error", "warn"] as const) : (["error"] as const);

  if (url.startsWith("libsql:")) {
    const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
    if (!authToken) {
      throw new Error(
        "TURSO_AUTH_TOKEN is required when DATABASE_URL uses libsql:// (Turso)."
      );
    }
    const libsql = createClient({ url, authToken });
    return new PrismaClient({
      adapter: new PrismaLibSQL(libsql),
      log: [...log],
    });
  }

  if (url.startsWith("file:")) {
    const resolved = toLibsqlFileUrl(url);
    const libsql = createClient({ url: resolved });
    return new PrismaClient({
      adapter: new PrismaLibSQL(libsql),
      log: [...log],
    });
  }

  throw new Error(
    'DATABASE_URL must start with "libsql:" (Turso) or "file:" (local SQLite). See .env.example.'
  );
}

function getOrCreatePrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClientInstance();
  }
  return globalForPrisma.prisma;
}

/**
 * Lazy singleton: avoids instantiating Prisma (and reading env) during Next.js
 * "Collecting page data" / static analysis when no DB call runs.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, _receiver) {
    const inst = getOrCreatePrisma();
    const value = Reflect.get(inst, prop as keyof PrismaClient, inst);
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(inst);
    }
    return value;
  },
});
