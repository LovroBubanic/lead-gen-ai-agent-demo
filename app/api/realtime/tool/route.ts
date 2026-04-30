import { runAgentToolByName } from "@/lib/agent-tools";
import { isContentType, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
const MAX_TOOL_BODY_BYTES = 32 * 1024;

/**
 * Executes captureLead / bookMeeting for the voice (Realtime) client after the model
 * emits a function_call. The browser cannot access the database directly.
 */
export async function POST(req: Request) {
  try {
    const limited = rateLimit(req, "realtime-tool", {
      limit: 60,
      windowMs: 60_000,
    });
    if (limited) return limited;

    if (!isContentType(req, "application/json")) {
      return Response.json(
        { output: JSON.stringify({ ok: false, error: "Expected JSON body" }) },
        { status: 415 }
      );
    }

    const rawBody = await req.text();
    if (rawBody.length > MAX_TOOL_BODY_BYTES) {
      return Response.json(
        { output: JSON.stringify({ ok: false, error: "Request body too large" }) },
        { status: 413 }
      );
    }

    const body = JSON.parse(rawBody) as {
      name?: string;
      arguments?: string;
    };
    const name = body.name?.trim();
    const args = body.arguments;
    if (!name || typeof args !== "string") {
      console.warn("[realtime/tool] missing name or arguments");
      return Response.json({
        output: JSON.stringify({ ok: false, error: "Missing name or arguments" }),
      });
    }
    const result = await runAgentToolByName(name, args);
    const toolReportedFailure =
      result &&
      typeof result === "object" &&
      "ok" in result &&
      (result as { ok?: boolean }).ok === false;
    if (toolReportedFailure) {
      console.warn("[realtime/tool] tool reported failure", name, result);
    } else {
      console.info("[realtime/tool] ok", name);
    }
    return Response.json({ output: JSON.stringify(result) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Tool execution failed";
    console.error("[realtime/tool] error", message);
    return Response.json({ output: JSON.stringify({ ok: false, error: message }) });
  }
}
