import { RealtimeCallPanel } from "@/components/call/realtime-call-panel";
import {
  getAgentLocale,
  getAgentRealtimeVoice,
  getVisitorUiPalette,
} from "@/lib/customer-ai-settings";

export const dynamic = "force-dynamic";

export default async function CallPage() {
  const [locale, voice, visitorPalette] = await Promise.all([
    getAgentLocale(),
    getAgentRealtimeVoice(),
    getVisitorUiPalette(),
  ]);
  return (
    <RealtimeCallPanel
      locale={locale}
      voice={voice}
      visitorPalette={visitorPalette}
    />
  );
}

