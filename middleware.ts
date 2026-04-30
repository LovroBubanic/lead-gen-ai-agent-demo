import { type NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { DASHBOARD_SESSION_COOKIE } from "@/lib/dashboard-constants";

function gatewaySecret() {
  const t = process.env.DASHBOARD_GATEWAY_TOKEN ?? "";
  return t.length >= 32 ? new TextEncoder().encode(t) : null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
    return NextResponse.next();
  }

  const secret = gatewaySecret();
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse(
        "Misconfiguration: set DASHBOARD_GATEWAY_TOKEN (32+ characters) for the owner dashboard.",
        { status: 503 }
      );
    }
    console.warn(
      "[ai-customer-support-lead-gen-agent] DASHBOARD_GATEWAY_TOKEN missing or too short — admin routes are open in development only."
    );
    return NextResponse.next();
  }

  const session = request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value;
  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  try {
    const { payload } = await jwtVerify(session, secret);
    if (payload.role !== "dashboard") {
      throw new Error("invalid role");
    }
    return NextResponse.next();
  } catch {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
