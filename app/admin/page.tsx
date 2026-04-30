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
  deleteLeadForm,
  deleteMeetingForm,
  logoutDashboard,
  saveCustomerInstructions,
  saveCustomerLocale,
  updateLeadForm,
  updateMeetingForm,
  uploadKnowledgePdf,
} from "./actions";

export const dynamic = "force-dynamic";

function serializeRows(
  leadsRaw: Awaited<ReturnType<typeof prisma.lead.findMany>>,
  docsRaw: Awaited<ReturnType<typeof prisma.knowledgeDocument.findMany>>,
  meetingsRaw: Awaited<ReturnType<typeof prisma.meeting.findMany>>
): {
  leads: SerializedLead[];
  docs: SerializedKnowledge[];
  meetings: SerializedMeeting[];
} {
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

  return { leads, docs, meetings };
}

export default async function AdminPage() {
  const supabaseConfigured = Boolean(getSupabaseServiceRole());

  let leads: SerializedLead[] = [];
  let docs: SerializedKnowledge[] = [];
  let meetings: SerializedMeeting[] = [];
  let customerInstructions = "";
  let customerLocale = "en";
  let dataLoadError: string | null = null;

  try {
    const [leadsRaw, docsRaw, meetingsRaw, instructions, locale] =
      await Promise.all([
        prisma.lead.findMany({ orderBy: { createdAt: "desc" } }),
        prisma.knowledgeDocument.findMany({ orderBy: { createdAt: "desc" } }),
        prisma.meeting.findMany({ orderBy: { startAt: "asc" } }),
        getCustomerResponseInstructions(),
        getAgentLocale(),
      ]);
    const serialized = serializeRows(leadsRaw, docsRaw, meetingsRaw);
    leads = serialized.leads;
    docs = serialized.docs;
    meetings = serialized.meetings;
    customerInstructions = instructions;
    customerLocale = locale;
  } catch (err) {
    console.error("[admin] failed to load dashboard data", err);
    if (process.env.NODE_ENV === "development") {
      dataLoadError =
        err instanceof Error ? err.message : "Unknown error while querying the database.";
    } else {
      dataLoadError =
        "Database query failed. Check DATABASE_URL / DIRECT_URL and that Prisma schema is applied.";
    }
    [customerInstructions, customerLocale] = await Promise.all([
      getCustomerResponseInstructions(),
      getAgentLocale(),
    ]);
  }

  return (
    <AdminDashboard
      leads={leads}
      meetings={meetings}
      docs={docs}
      customerInstructions={customerInstructions}
      customerLocale={customerLocale}
      supabaseConfigured={supabaseConfigured}
      dataLoadError={dataLoadError}
      actions={{
        addKnowledgeDocument,
        deleteKnowledgeForm,
        deleteLeadForm,
        deleteMeetingForm,
        logoutDashboard,
        uploadKnowledgePdf,
        saveCustomerInstructions,
        saveCustomerLocale,
        updateLeadForm,
        updateMeetingForm,
      }}
    />
  );
}
