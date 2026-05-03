import { ChatPanel } from "@/components/chat/chat-panel";
import { getAgentLocale, getVisitorUiPalette } from "@/lib/customer-ai-settings";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const [locale, visitorPalette] = await Promise.all([
    getAgentLocale(),
    getVisitorUiPalette(),
  ]);
  return <ChatPanel locale={locale} visitorPalette={visitorPalette} />;
}

