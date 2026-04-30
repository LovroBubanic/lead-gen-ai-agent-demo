/**
 * Validates DATABASE_URL + DIRECT_URL for Supabase + Prisma.
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

function parseUrl(urlStr) {
  return new URL(urlStr.replace(/^postgres:/i, "postgresql:"));
}

function noBracketPassword(urlStr, label) {
  if (/:\[[^\]]+\]@/.test(urlStr) || /%5B[^\]]+%5D/.test(urlStr)) {
    console.error(`
${label}: password must NOT be wrapped in [square brackets].
Remove [ and ] from the password part of the URI (Supabase docs use [YOUR_PASSWORD] only as a hint).
`);
    process.exit(1);
  }
}

const root = path.join(__dirname, "..");
const env = loadEnvFile(path.join(root, ".env"));

for (const k of ["DATABASE_URL", "DIRECT_URL"]) {
  if (!env[k]) {
    console.error(`Missing ${k} in .env`);
    process.exit(1);
  }
  noBracketPassword(env[k], k);
}

const db = parseUrl(env.DATABASE_URL);
const dr = parseUrl(env.DIRECT_URL);

if (!db.hostname.includes("pooler.supabase.com") || db.port !== "6543") {
  console.error("DATABASE_URL must be transaction pooler :6543 (*.pooler.supabase.com).");
  process.exit(1);
}
if (!String(env.DATABASE_URL).includes("pgbouncer=true")) {
  console.error("DATABASE_URL must include pgbouncer=true.");
  process.exit(1);
}

if (!dr.hostname.includes("pooler.supabase.com") || dr.port !== "5432") {
  console.error(
    "DIRECT_URL must be session pooler :5432 on same host as DATABASE_URL (see README), OR direct db.*:5432 with user postgres."
  );
  process.exit(1);
}

const dbUser = decodeURIComponent(db.username || "");
const drUser = decodeURIComponent(dr.username || "");
if (!dbUser.includes(".") || dbUser !== drUser) {
  console.error(
    "DATABASE_URL and DIRECT_URL must use the same pooler username postgres.<project-ref>."
  );
  process.exit(1);
}

console.log(
  "check:db-env — OK: transaction :6543 + session :5432 pooler, same user, no [brackets] in password."
);
console.log("Next: npm run db:push");
