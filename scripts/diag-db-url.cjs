/** Print URL shape only (no password). Run: node scripts/diag-db-url.cjs */
const fs = require("fs");
const path = require("path");

function loadEnv() {
  const p = path.join(__dirname, "..", ".env");
  const out = {};
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

function show(name, raw) {
  if (!raw) {
    console.log(name, "MISSING");
    return;
  }
  let u;
  try {
    u = new URL(raw.replace(/^postgres:/i, "postgresql:"));
  } catch {
    console.log(name, "NOT_A_VALID_URL");
    return;
  }
  const pw = decodeURIComponent(u.password || "");
  console.log(
    name,
    "| host:",
    u.hostname,
    "| port:",
    u.port,
    "| user:",
    JSON.stringify(u.username),
    "| password length:",
    pw.length,
    "| needs URL-encoding:",
    /[ @#%&+=:?]/.test(pw)
  );
}

const env = loadEnv();
show("DATABASE_URL", env.DATABASE_URL);
show("DIRECT_URL", env.DIRECT_URL);
