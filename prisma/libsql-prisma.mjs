/**
 * Shared libSQL + driver adapter wiring for Prisma in Node scripts (e.g. seed).
 * Keep in sync with lib/prisma.ts
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { PrismaClient } from "@prisma/client";

/** libsql resolves `file:` relative to cwd; Prisma CLI resolves relative to prisma/. */
function toLibsqlFileUrl(databaseUrl) {
  if (!databaseUrl.startsWith("file:")) return databaseUrl;
  const rest = databaseUrl.slice("file:".length).replace(/\\/g, "/");
  if (rest.startsWith("//") || /^\/[A-Za-z]:\//.test(rest) || /^[A-Za-z]:\//.test(rest)) {
    return databaseUrl;
  }
  const rel = rest.replace(/^\.\//, "");
  const abs = path.join(process.cwd(), "prisma", rel);
  return pathToFileURL(abs).href;
}

export function createPrismaClient() {
  const url = process.env.DATABASE_URL;
  if (!url || !String(url).trim()) {
    throw new Error("DATABASE_URL is not set.");
  }

  if (String(url).startsWith("libsql:")) {
    const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
    if (!authToken) {
      throw new Error(
        "TURSO_AUTH_TOKEN is required when DATABASE_URL uses libsql:// (Turso)."
      );
    }
    const libsql = createClient({ url, authToken });
    return new PrismaClient({
      adapter: new PrismaLibSQL(libsql),
    });
  }

  if (String(url).startsWith("file:")) {
    const resolved = toLibsqlFileUrl(String(url));
    const libsql = createClient({ url: resolved });
    return new PrismaClient({
      adapter: new PrismaLibSQL(libsql),
    });
  }

  throw new Error(
    'DATABASE_URL must start with "libsql:" (Turso) or "file:" (local SQLite).'
  );
}
