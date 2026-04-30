import { RealtimeCallPanel } from "@/components/call/realtime-call-panel";
import { getAgentLocale } from "@/lib/customer-ai-settings";

export const dynamic = "force-dynamic";

export default async function CallPage() {
  const locale = await getAgentLocale();
  return <RealtimeCallPanel locale={locale} />;
}

