import { tool } from "@langchain/core/tools";
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import {
  bookMeetingInputSchema,
  captureLeadInputSchema,
  executeBookMeeting,
  executeCaptureLead,
  executeShowListingImage,
  showListingImageInputSchema,
} from "@/lib/agent-tools";
import { tool as aiTool } from "ai";
import { localeLabel, normalizeCustomerLocale } from "@/lib/locales";

const captureLeadLc = tool(
  async (input) => executeCaptureLead(input),
  {
    name: "captureLead",
    description:
      "Save a sales lead when the visitor has shared their real name and email and you understand what they want. Call at most once per clear opt-in.",
    schema: captureLeadInputSchema,
  }
);

const bookMeetingLc = tool(
  async (input) => executeBookMeeting(input),
  {
    name: "bookMeeting",
    description:
      "Save a calendar booking after the visitor agrees to a concrete date, time, and connection method (Meet, Zoom, or phone). ISO start/end must include timezone offset (+02:00) or Z; naive times use server BOOKING_INPUT_TIMEZONE (default UTC).",
    schema: bookMeetingInputSchema,
  }
);

const showListingImageLc = tool(
  async (input) => executeShowListingImage(input),
  {
    name: "showListingImage",
    description:
      "Show a property/listing photo in the chat when the visitor asks to see the property, exterior, photos, kitchen, garden, or similar. Use the knowledgeDocumentId from the knowledge base (Listing ID for photos). Use imageIndex 0 for the main photo, or higher numbers for additional photos.",
    schema: showListingImageInputSchema,
  }
);

export const salesChatLangChainTools = [
  captureLeadLc,
  bookMeetingLc,
  showListingImageLc,
];

/** AI SDK tools for `convertToModelMessages` (UIMessage → model messages). */
export const salesChatAiSdkTools = {
  captureLead: aiTool({
    description: captureLeadLc.description,
    inputSchema: captureLeadInputSchema,
    execute: async (input) => executeCaptureLead(input),
  }),
  bookMeeting: aiTool({
    description: bookMeetingLc.description,
    inputSchema: bookMeetingInputSchema,
    execute: async (input) => executeBookMeeting(input),
  }),
  showListingImage: aiTool({
    description: showListingImageLc.description,
    inputSchema: showListingImageInputSchema,
    execute: async (input) => executeShowListingImage(input),
  }),
};

export function buildSalesChatSystemPrompt(
  knowledgeBlock: string,
  ownerInstructions: string,
  locale: string
): string {
  const code = normalizeCustomerLocale(locale);
  const langName = localeLabel(code);
  const owner = ownerInstructions.trim();
  const ownerSection = owner
    ? `\n\n## Owner instructions (tone, offers, boundaries — follow closely)\n${owner}`
    : "";
  const langSection = `\n\n## Language\nYou MUST write every assistant message only in ${langName} (ISO 639-1 code: ${code}). That includes explanations, questions, apologies, and any user-visible text you produce. Natural-language fields in tool arguments (for example summaries or titles where applicable) must also be in ${langName}.`;
  return `You are a warm, professional AI lead and booking assistant (mobile-first chat). Goals:
- Use the KNOWLEDGE BASE when it helps; otherwise say you will pass details to the team.
- Be concise. Ask one focused question at a time when qualifying.
- When (and only when) the visitor gives a real name and email and you know their intent, call captureLead once.
- When the visitor confirms a specific meeting window and how to connect, call bookMeeting with ISO-8601 start/end datetimes including an explicit timezone offset (e.g. 2026-05-05T15:00:00+02:00) or Z for UTC; use the real agreed calendar date and time, meetingType, and locationDetail (link or phone).
- When the visitor asks to see photos of a property or listing that appears in the knowledge base with a listing ID, call showListingImage with that knowledgeDocumentId (and imageIndex if they ask for a specific shot).
- Never fabricate personal data or meetings.

## Knowledge base
${knowledgeBlock}${ownerSection}${langSection}`;
}

export function createSalesChatGraph(
  knowledgeBlock: string,
  ownerInstructions: string = "",
  locale: string = "en"
) {
  const modelId = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const llm = new ChatOpenAI({
    model: modelId,
    temperature: 0,
  });
  return createReactAgent({
    llm,
    tools: salesChatLangChainTools,
    prompt: buildSalesChatSystemPrompt(knowledgeBlock, ownerInstructions, locale),
  });
}
