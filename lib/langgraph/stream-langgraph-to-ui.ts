import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  isToolMessage,
} from "@langchain/core/messages";
import type { UIMessageChunk } from "ai";

type ToolsStreamEvent =
  | {
      event: "on_tool_start";
      toolCallId?: string;
      name: string;
      input: unknown;
    }
  | {
      event: "on_tool_end";
      toolCallId?: string;
      name: string;
      output: unknown;
    }
  | {
      event: "on_tool_error";
      toolCallId?: string;
      name: string;
      error: unknown;
    };

function extractTextFromAi(msg: AIMessage | AIMessageChunk): string {
  const c = msg.content;
  if (typeof c === "string") return c;
  if (!Array.isArray(c)) return "";
  let s = "";
  for (const part of c) {
    if (typeof part === "string") s += part;
    else if (
      part &&
      typeof part === "object" &&
      "type" in part &&
      (part as { type?: string }).type === "text" &&
      "text" in part
    ) {
      s += String((part as { text?: string }).text ?? "");
    }
  }
  return s;
}

function stringifyUnknown(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export async function streamLangGraphAgentToUiChunks(options: {
  agent: {
    stream: (
      input: { messages: BaseMessage[] },
      config: {
        streamMode: ["messages", "tools"];
        recursionLimit: number;
      }
    ) => Promise<AsyncIterable<unknown>>;
  };
  messages: BaseMessage[];
  writer: { write: (chunk: UIMessageChunk) => void };
  generateId: () => string;
  recursionLimit?: number;
}): Promise<void> {
  const { agent, messages, writer, generateId, recursionLimit = 10 } = options;
  let textPartId: string | null = null;
  const pendingAnonToolIds: string[] = [];

  const closeText = () => {
    if (textPartId) {
      writer.write({ type: "text-end", id: textPartId });
      textPartId = null;
    }
  };

  const ensureTextStarted = () => {
    if (!textPartId) {
      textPartId = generateId();
      writer.write({ type: "text-start", id: textPartId });
    }
  };

  const toolCallIdForEnd = (id: string | undefined) => {
    if (id && id.length > 0) return id;
    return pendingAnonToolIds.shift() ?? generateId();
  };

  const stream = await agent.stream(
    { messages },
    { streamMode: ["messages", "tools"], recursionLimit }
  );

  for await (const raw of stream) {
    if (!Array.isArray(raw) || raw.length !== 2) continue;
    const mode = raw[0] as string;
    const payload = raw[1];

    if (mode === "messages") {
      const tuple = payload as [BaseMessage, object];
      const msg = tuple[0];
      if (isToolMessage(msg)) continue;

      if (AIMessageChunk.isInstance(msg)) {
        const delta = extractTextFromAi(msg);
        if (delta) {
          ensureTextStarted();
          writer.write({
            type: "text-delta",
            id: textPartId!,
            delta,
          });
        }
        const tc = msg.tool_call_chunks;
        if (tc && tc.length > 0) closeText();
        continue;
      }

      if (AIMessage.isInstance(msg)) {
        const delta = extractTextFromAi(msg);
        if (delta) {
          ensureTextStarted();
          writer.write({
            type: "text-delta",
            id: textPartId!,
            delta,
          });
        }
        if (msg.tool_calls && msg.tool_calls.length > 0) closeText();
      }
      continue;
    }

    if (mode === "tools") {
      const ev = payload as ToolsStreamEvent;
      if (ev.event === "on_tool_start") {
        closeText();
        let toolCallId =
          typeof ev.toolCallId === "string" && ev.toolCallId.length > 0
            ? ev.toolCallId
            : undefined;
        if (!toolCallId) {
          toolCallId = generateId();
          pendingAnonToolIds.push(toolCallId);
        }
        writer.write({
          type: "tool-input-available",
          toolCallId,
          toolName: ev.name,
          input: ev.input,
        });
      } else if (ev.event === "on_tool_end") {
        const toolCallId = toolCallIdForEnd(ev.toolCallId);
        writer.write({
          type: "tool-output-available",
          toolCallId,
          output: ev.output,
        });
      } else if (ev.event === "on_tool_error") {
        const toolCallId = toolCallIdForEnd(ev.toolCallId);
        writer.write({
          type: "tool-output-error",
          toolCallId,
          errorText: stringifyUnknown(ev.error),
        });
      }
    }
  }

  closeText();
}
