import type { ModelMessage, ToolResultOutput } from "@ai-sdk/provider-utils";
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  ToolMessage,
} from "@langchain/core/messages";

function userContentToString(
  content: import("@ai-sdk/provider-utils").UserModelMessage["content"]
): string {
  if (typeof content === "string") return content;
  const parts: string[] = [];
  for (const p of content) {
    if (p.type === "text") parts.push(p.text);
  }
  return parts.join("");
}

function toolResultToString(output: ToolResultOutput): string {
  if (output.type === "text") return output.value;
  if (output.type === "json") return JSON.stringify(output.value);
  if (output.type === "content") {
    return output.value
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");
  }
  if (output.type === "error-text") return output.value;
  if (output.type === "error-json") return JSON.stringify(output.value);
  if (output.type === "execution-denied")
    return JSON.stringify({ denied: true, reason: output.reason });
  return JSON.stringify(output);
}

function assistantModelToMessages(m: import("@ai-sdk/provider-utils").AssistantModelMessage): BaseMessage[] {
  const content = m.content;
  if (typeof content === "string") {
    return [new AIMessage({ content })];
  }
  const textParts: string[] = [];
  const toolCalls: { id: string; name: string; args: Record<string, unknown> }[] =
    [];
  for (const p of content) {
    if (p.type === "text") textParts.push(p.text);
    if (p.type === "tool-call") {
      const input = p.input;
      const args =
        typeof input === "object" && input !== null && !Array.isArray(input)
          ? (input as Record<string, unknown>)
          : { value: input as unknown };
      toolCalls.push({
        id: p.toolCallId,
        name: p.toolName,
        args,
      });
    }
  }
  const text = textParts.join("");
  if (toolCalls.length === 0) {
    return [new AIMessage({ content: text })];
  }
  return [
    new AIMessage({
      content: text,
      tool_calls: toolCalls.map((tc) => ({
        id: tc.id,
        name: tc.name,
        args: tc.args,
      })),
    }),
  ];
}

function toolModelToMessages(m: import("@ai-sdk/provider-utils").ToolModelMessage): ToolMessage[] {
  const out: ToolMessage[] = [];
  for (const p of m.content) {
    if (p.type === "tool-result") {
      out.push(
        new ToolMessage({
          content: toolResultToString(p.output),
          tool_call_id: p.toolCallId,
          name: p.toolName,
        })
      );
    }
  }
  return out;
}

/** Converts AI SDK model messages (same shape as `convertToModelMessages`) to LangChain messages. */
export function modelMessagesToLangChainMessages(
  modelMessages: ModelMessage[]
): BaseMessage[] {
  const out: BaseMessage[] = [];
  for (const m of modelMessages) {
    if (m.role === "user") {
      out.push(new HumanMessage({ content: userContentToString(m.content) }));
    } else if (m.role === "assistant") {
      out.push(...assistantModelToMessages(m));
    } else if (m.role === "tool") {
      out.push(...toolModelToMessages(m));
    }
  }
  return out;
}
