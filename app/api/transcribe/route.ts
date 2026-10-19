import { OpenAIClient, toFile } from "@langchain/openai";
import { getAgentLocale } from "@/lib/customer-ai-settings";
import { normalizeCustomerLocale } from "@/lib/locales";
import { isContentType, rateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

const MAX_BYTES = 15 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const limited = rateLimit(req, "transcribe", { limit: 20, windowMs: 60_000 });
    if (limited) return limited;

    if (!isContentType(req, "multipart/form-data")) {
      return Response.json(
        { error: "Expected multipart form data" },
        { status: 415 }
      );
    }

    if (!process.env.OPENAI_API_KEY?.trim()) {
      return Response.json(
        {
          error:
            "Missing OPENAI_API_KEY. Set it in .env, then restart the dev server.",
        },
        { status: 500 }
      );
    }
    const form = await req.formData();
    const file = form.get("audio");
    if (!(file instanceof Blob) || file.size === 0) {
      return Response.json({ error: "Missing or empty audio" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return Response.json({ error: "Audio file is too large" }, { status: 413 });
    }
    const audio = new Uint8Array(await file.arrayBuffer());
    const locale = normalizeCustomerLocale(await getAgentLocale());
    const client = new OpenAIClient({ apiKey: process.env.OPENAI_API_KEY });
    const upload = await toFile(audio, "voice-note.webm");
    const result = await client.audio.transcriptions.create({
      model: "gpt-transcribe",
      file: upload,
      language: locale,
    });
    return Response.json({ text: result.text.trim() });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Transcription failed" }, { status: 500 });
  }
}
