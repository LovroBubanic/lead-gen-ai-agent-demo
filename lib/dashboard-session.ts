import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { DASHBOARD_SESSION_COOKIE } from "@/lib/dashboard-constants";

function getSecretKey() {
  const t = process.env.DASHBOARD_GATEWAY_TOKEN ?? "";
  if (t.length < 32) {
    throw new Error(
      "DASHBOARD_GATEWAY_TOKEN must be at least 32 characters (use a long random string)."
    );
  }
  return new TextEncoder().encode(t);
}

/** Issue a short-lived signed session after the gateway token is verified. */
export async function signDashboardSession(): Promise<string> {
  const secret = getSecretKey();
  return new SignJWT({ role: "dashboard" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyDashboardSessionToken(
  token: string | undefined
): Promise<boolean> {
  if (!token) return false;
  try {
    const secret = getSecretKey();
    const { payload } = await jwtVerify(token, secret);
    return payload.role === "dashboard";
  } catch {
    return false;
  }
}

export async function verifyDashboardCookie(): Promise<boolean> {
  const jar = await cookies();
  return verifyDashboardSessionToken(jar.get(DASHBOARD_SESSION_COOKIE)?.value);
}
