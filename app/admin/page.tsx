import { AdminDashboard } from "@/components/admin/admin-dashboard";
import type {
  SerializedKnowledge,
  SerializedLead,
  SerializedMeeting,
} from "@/components/admin/types";
import { prisma } from "@/lib/prisma";
import { getAgentLocale, getCustomerResponseInstructions } from "@/lib/customer-ai-settings";
import { asImagePathList } from "@/lib/listing-images";
import { getSupabaseServiceRole } from "@/lib/supabase-server";
import {
  addKnowledgeDocument,
  deleteKnowledgeForm,
  deleteMeetingForm,
  logoutDashboard,
  saveCustomerInstructions,
  saveCustomerLocale,
  uploadKnowledgePdf,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabaseConfigured = Boolean(getSupabaseServiceRole());
  const [leadsRaw, docsRaw, meetingsRaw, customerInstructions, customerLocale] =
    await Promise.all([
      prisma.lead.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.knowledgeDocument.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.meeting.findMany({ orderBy: { startAt: "asc" } }),
      getCustomerResponseInstructions(),
      getAgentLocale(),
    ]);

  const leads: SerializedLead[] = leadsRaw.map((l) => ({
    id: l.id,
    name: l.name,
    email: l.email,
    intent: l.intent,
    summary: l.summary,
    createdAt: l.createdAt.toISOString(),
  }));

  const docs: SerializedKnowledge[] = docsRaw.map((d) => ({
    id: d.id,
    title: d.title,
    content: d.content,
    sourceType: d.sourceType,
    filePath: d.filePath,
    imageCount: asImagePathList(d.imagePaths).length,
    createdAt: d.createdAt.toISOString(),
  }));

  const meetings: SerializedMeeting[] = meetingsRaw.map((m) => ({
    id: m.id,
    title: m.title,
    startAt: m.startAt.toISOString(),
    endAt: m.endAt.toISOString(),
    attendeeName: m.attendeeName,
    attendeeEmail: m.attendeeEmail,
    notes: m.notes,
    meetingType: m.meetingType,
    locationDetail: m.locationDetail,
    bookedByAgent: m.bookedByAgent,
    createdAt: m.createdAt.toISOString(),
  }));

  return (
    <AdminDashboard
      leads={leads}
      meetings={meetings}
      docs={docs}
      customerInstructions={customerInstructions}
      customerLocale={customerLocale}
      supabaseConfigured={supabaseConfigured}
      actions={{
        addKnowledgeDocument,
        deleteKnowledgeForm,
        deleteMeetingForm,
        logoutDashboard,
        uploadKnowledgePdf,
        saveCustomerInstructions,
        saveCustomerLocale,
      }}
    />
  );
}
