import { buildRealtimeCallSessionJson } from "@/lib/realtime/realtime-session";
import { isContentType, rateLimit } from "@/lib/rate-limit";
import { normalizeOpenAIRealtimeVoice } from "@/lib/openai-realtime-voices";

export const maxDuration = 120;
export const runtime = "nodejs";
const MAX_SDP_BYTES = 128 * 1024;

function parseMic(v: string | null): "near_field" | "far_field" {
  return v === "near_field" ? "near_field" : "far_field";
}

function parseVad(v: string | null): "semantic" | "server" {
  return v === "server" ? "server" : "semantic";
}

function parseVoice(v: string | null): string | undefined {
  const fromQuery = v?.trim();
  if (fromQuery) return normalizeOpenAIRealtimeVoice(fromQuery);
  return undefined;
}

export async function POST(req: Request) {
  const limited = rateLimit(req, "realtime-calls", {
    limit: 12,
    windowMs: 60_000,
  });
  if (limited) return limited;

  if (!isContentType(req, "application/sdp")) {
    return new Response("Expected application/sdp body.", {
      status: 415,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return new Response(
      "Missing OPENAI_API_KEY. Set it in .env, then restart the dev server.",
      { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }

  const sdp = await req.text();
  if (sdp.length > MAX_SDP_BYTES) {
    return new Response("SDP body is too large.", {
      status: 413,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  if (!sdp.includes("v=0")) {
    return new Response("Expected raw SDP (application/sdp) body.", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const url = new URL(req.url);
  const sessionJson = await buildRealtimeCallSessionJson({
    mic: parseMic(url.searchParams.get("mic")),
    vad: parseVad(url.searchParams.get("vad")),
    voice: parseVoice(url.searchParams.get("voice")),
  });

  const fd = new FormData();
  fd.append("sdp", sdp);
  fd.append("session", sessionJson);

  const upstream = await fetch("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: fd,
  });

  const answer = await upstream.text();
  if (!upstream.ok) {
    return new Response(answer || upstream.statusText, {
      status: upstream.status,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return new Response(answer, {
    status: 200,
    headers: {
      "Content-Type": "application/sdp; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
