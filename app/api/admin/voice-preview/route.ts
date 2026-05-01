import { verifyDashboardCookie } from "@/lib/dashboard-session";
import { normalizeCustomerLocale } from "@/lib/locales";
import { normalizeOpenAIRealtimeVoice } from "@/lib/openai-realtime-voices";
import { isContentType, rateLimit } from "@/lib/rate-limit";
import { voicePreviewPhrase } from "@/lib/voice-preview-phrases";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const limited = rateLimit(req, "admin-voice-preview", {
    limit: 24,
    windowMs: 60_000,
  });
  if (limited) return limited;

  if (!(await verifyDashboardCookie())) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!isContentType(req, "application/json")) {
    return Response.json({ error: "Expected application/json" }, { status: 415 });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return Response.json(
      { error: "Missing OPENAI_API_KEY on the server." },
      { status: 500 }
    );
  }

  let body: { voice?: unknown; language?: unknown };
  try {
    body = (await req.json()) as { voice?: unknown; language?: unknown };
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const voice = normalizeOpenAIRealtimeVoice(
    typeof body.voice === "string" ? body.voice : ""
  );
  const language = normalizeCustomerLocale(
    typeof body.language === "string" ? body.language : "en"
  );
  const input = voicePreviewPhrase(language);

  const upstream = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts",
      voice,
      input,
      response_format: "mp3",
    }),
  });

  const buf = await upstream.arrayBuffer();
  if (!upstream.ok) {
    const errText = new TextDecoder().decode(buf).slice(0, 800);
    return new Response(errText || upstream.statusText, {
      status: upstream.status,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return new Response(buf, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}
