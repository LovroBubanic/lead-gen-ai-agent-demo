import { ChatPanel } from "@/components/chat/chat-panel";
import { getAgentLocale } from "@/lib/customer-ai-settings";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const locale = await getAgentLocale();
  return <ChatPanel locale={locale} />;
}

