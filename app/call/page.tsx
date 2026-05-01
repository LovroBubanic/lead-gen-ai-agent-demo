import { RealtimeCallPanel } from "@/components/call/realtime-call-panel";
import { getAgentLocale, getAgentRealtimeVoice } from "@/lib/customer-ai-settings";

export const dynamic = "force-dynamic";

export default async function CallPage() {
  const [locale, voice] = await Promise.all([
    getAgentLocale(),
    getAgentRealtimeVoice(),
  ]);
  return <RealtimeCallPanel locale={locale} voice={voice} />;
}

