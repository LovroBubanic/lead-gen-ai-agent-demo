/**
 * Validates DATABASE_URL (+ TURSO_AUTH_TOKEN for Turso) for Prisma + libSQL.
 * Run: npm run check:db-env
 */
const fs = require("fs");
const path = require("path");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`Missing file: ${filePath}`);
    process.exit(1);
  }
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

const root = path.join(__dirname, "..");
const env = loadEnvFile(path.join(root, ".env"));

const dbUrl = env.DATABASE_URL?.trim();
if (!dbUrl) {
  console.error("Missing DATABASE_URL in .env");
  process.exit(1);
}

if (dbUrl.startsWith("libsql:")) {
  if (!env.TURSO_AUTH_TOKEN?.trim()) {
    console.error(
      "DATABASE_URL uses libsql:// (Turso) but TURSO_AUTH_TOKEN is missing in .env"
    );
    process.exit(1);
  }
  console.log(
    "check:db-env — OK: Turso (libsql://) with TURSO_AUTH_TOKEN set."
  );
  console.log(
    "Note: Prisma CLI may not apply schema to remote Turso from all versions; if `npm run db:push` fails, use a local file URL (see README) then apply SQL with the Turso CLI."
  );
  console.log("Next: npm run db:push   then   npm run db:seed");
  process.exit(0);
}

if (dbUrl.startsWith("file:")) {
  console.log(
    "check:db-env — OK: local SQLite file URL (paths like file:./dev.db are relative to the prisma/ folder)."
  );
  console.log("Next: npm run db:push   then   npm run db:seed");
  process.exit(0);
}

console.error(
  'DATABASE_URL must start with "libsql:" (Turso) or "file:" (local SQLite). See .env.example.'
);
process.exit(1);
