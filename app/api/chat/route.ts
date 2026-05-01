import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  type UIMessage,
} from "ai";
import { buildKnowledgeContext } from "@/lib/knowledge";
import { buildMeetingCalendarContextForAgent } from "@/lib/meeting-calendar-context";
import {
  getAgentLocale,
  getCustomerResponseInstructions,
} from "@/lib/customer-ai-settings";
import { modelMessagesToLangChainMessages } from "@/lib/langgraph/ui-messages-to-lc";
import {
  createSalesChatGraph,
  salesChatAiSdkTools,
} from "@/lib/langgraph/sales-chat-agent";
import { streamLangGraphAgentToUiChunks } from "@/lib/langgraph/stream-langgraph-to-ui";
import { isContentType, rateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

const MAX_CHAT_BODY_BYTES = 128 * 1024;

export async function POST(req: Request) {
  try {
    const limited = rateLimit(req, "chat", { limit: 30, windowMs: 60_000 });
    if (limited) return limited;

    if (!isContentType(req, "application/json")) {
      return Response.json({ error: "Expected JSON request body" }, { status: 415 });
    }

    const raw = await req.text();
    if (raw.length > MAX_CHAT_BODY_BYTES) {
      return Response.json({ error: "Request body too large" }, { status: 413 });
    }

    let body: { messages?: UIMessage[] };
    try {
      body = JSON.parse(raw) as { messages?: UIMessage[] };
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const messages = body.messages as UIMessage[];
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Invalid messages" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!process.env.OPENAI_API_KEY?.trim()) {
      return new Response(
        JSON.stringify({
          error:
            "Missing OPENAI_API_KEY. Set it in .env (see README), then restart the dev server.",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    const [kb, ownerInstructions, locale, calendarBlock] = await Promise.all([
      buildKnowledgeContext(),
      getCustomerResponseInstructions(),
      getAgentLocale(),
      buildMeetingCalendarContextForAgent(),
    ]);
    const modelMessages = await convertToModelMessages(messages, {
      tools: salesChatAiSdkTools,
    });
    const lcMessages = modelMessagesToLangChainMessages(modelMessages);
    const agent = createSalesChatGraph(kb, ownerInstructions, locale, calendarBlock);

    const stream = createUIMessageStream({
      originalMessages: messages,
      execute: async ({ writer }) => {
        writer.write({ type: "start" });
        await streamLangGraphAgentToUiChunks({
          agent,
          messages: lcMessages,
          writer,
          generateId,
          recursionLimit: 10,
        });
        writer.write({ type: "finish", finishReason: "stop" });
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "Chat failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
