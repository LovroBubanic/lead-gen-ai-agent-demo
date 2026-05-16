/** Print DATABASE_URL shape only (no secrets). Run: node scripts/diag-db-url.cjs */
const fs = require("fs");
const path = require("path");

function loadEnv() {
  const p = path.join(__dirname, "..", ".env");
  const out = {};
  if (!fs.existsSync(p)) {
    console.error("No .env file found at", p);
    process.exit(1);
  }
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
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

function showDatabaseUrl(raw) {
  if (!raw) {
    console.log("DATABASE_URL", "MISSING");
    return;
  }
  const s = String(raw);
  if (s.startsWith("libsql:")) {
    let host = "?";
    try {
      host = new URL(s.replace(/^libsql:/i, "https:")).hostname;
    } catch {
      /* ignore */
    }
    console.log("DATABASE_URL", "| kind: libsql (Turso) | host:", host);
    return;
  }
  if (s.startsWith("file:")) {
    console.log("DATABASE_URL", "| kind: local SQLite file");
    return;
  }
  console.log("DATABASE_URL", "| kind: unknown (expected libsql: or file:)");
}

function showTokenPresent(name, raw) {
  if (!raw || !String(raw).trim()) {
    console.log(name, "MISSING");
    return;
  }
  console.log(name, "| set: yes | length:", String(raw).trim().length);
}

const env = loadEnv();
showDatabaseUrl(env.DATABASE_URL);
showTokenPresent("TURSO_AUTH_TOKEN", env.TURSO_AUTH_TOKEN);
