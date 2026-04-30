"use server";

import { randomUUID, timingSafeEqual } from "crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DASHBOARD_SESSION_COOKIE } from "@/lib/dashboard-constants";
import { signDashboardSession, verifyDashboardCookie } from "@/lib/dashboard-session";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseBookMeetingIsoToUtc } from "@/lib/meeting-datetime";
import { AGENT_SETTINGS_ID } from "@/lib/customer-ai-settings";
import { asImagePathList, isHttpImageRef } from "@/lib/listing-images";
import { getSupabaseServiceRole } from "@/lib/supabase-server";
import { normalizeCustomerLocale } from "@/lib/locales";

const PDF_MAX_BYTES = 8 * 1024 * 1024;
const KNOWLEDGE_BUCKET = "knowledge-pdfs";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES_PER_DOC = 8;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function sanitizeNext(next: string | undefined): string {
  if (!next || !next.startsWith("/admin") || next.startsWith("//")) {
    return "/admin";
  }
  return next;
}

function safeEq(a: string, b: string): boolean {
  try {
    const x = Buffer.from(a, "utf8");
    const y = Buffer.from(b, "utf8");
    if (x.length !== y.length) return false;
    return timingSafeEqual(x, y);
  } catch {
    return false;
  }
}

export async function loginWithGatewayToken(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const expected = process.env.DASHBOARD_GATEWAY_TOKEN ?? "";
  if (expected.length < 32 || !safeEq(token, expected)) {
    redirect("/admin/login?e=1");
  }
  const jwt = await signDashboardSession();
  const jar = await cookies();
  jar.set(DASHBOARD_SESSION_COOKIE, jwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  redirect(sanitizeNext(String(formData.get("next") ?? "")));
}

export async function logoutDashboard() {
  const jar = await cookies();
  jar.delete(DASHBOARD_SESSION_COOKIE);
  redirect("/admin/login");
}

async function assertDashboard() {
  if (!(await verifyDashboardCookie())) {
    redirect("/admin/login");
  }
}

export async function addKnowledgeDocument(formData: FormData) {
  await assertDashboard();
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  if (!title || !content) return;

  const doc = await prisma.knowledgeDocument.create({
    data: {
      title,
      content,
      sourceType: "text",
    },
  });

  const supabase = getSupabaseServiceRole();
  const uploadedPaths: string[] = [];
  const files = formData
    .getAll("images")
    .filter((x): x is File => x instanceof File && x.size > 0);

  if (supabase && files.length > 0) {
    for (let j = 0; j < Math.min(files.length, MAX_IMAGES_PER_DOC); j++) {
      const file = files[j];
      if (file.size > MAX_IMAGE_BYTES) continue;
      const mime = file.type;
      if (!ALLOWED_IMAGE_TYPES.has(mime)) continue;
      const ext =
        mime === "image/png"
          ? "png"
          : mime === "image/webp"
            ? "webp"
          : mime === "image/gif"
            ? "gif"
            : "jpg";
      const path = `listing-images/${doc.id}/${uploadedPaths.length}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      const { error } = await supabase.storage
        .from(KNOWLEDGE_BUCKET)
        .upload(path, buffer, {
          contentType: mime,
          upsert: true,
        });
      if (!error) uploadedPaths.push(path);
    }
  }

  if (uploadedPaths.length > 0) {
    await prisma.knowledgeDocument.update({
      where: { id: doc.id },
      data: { imagePaths: uploadedPaths },
    });
  }
  revalidatePath("/admin");
}

export async function deleteKnowledgeForm(formData: FormData) {
  await assertDashboard();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const doc = await prisma.knowledgeDocument.findUnique({ where: { id } });
  if (doc?.filePath) {
    const supabase = getSupabaseServiceRole();
    if (supabase) {
      await supabase.storage.from(KNOWLEDGE_BUCKET).remove([doc.filePath]);
    }
  }
  const supabase = getSupabaseServiceRole();
  if (doc) {
    for (const p of asImagePathList(doc.imagePaths)) {
      if (!isHttpImageRef(p) && supabase) {
        await supabase.storage.from(KNOWLEDGE_BUCKET).remove([p]);
      }
    }
  }
  await prisma.knowledgeDocument.delete({ where: { id } });
  revalidatePath("/admin");
}

export async function uploadKnowledgePdf(formData: FormData) {
  await assertDashboard();
  const file = formData.get("pdf");
  if (!(file instanceof File) || file.size === 0) return;
  if (file.size > PDF_MAX_BYTES) return;
  if (file.type !== "application/pdf") return;

  const buffer = Buffer.from(await file.arrayBuffer());
  let text: string;
  try {
    const { extractPdfText } = await import("@/lib/extract-pdf-text");
    text = await extractPdfText(buffer);
  } catch {
    return;
  }
  if (!text) {
    text = "(No extractable text in this PDF; try another file or paste text manually.)";
  }

  const title = file.name.replace(/\.pdf$/i, "") || "Uploaded PDF";
  const id = randomUUID();
  const storagePath = `pdfs/${id}.pdf`;

  let filePath: string | null = null;
  const supabase = getSupabaseServiceRole();
  if (supabase) {
    const { error } = await supabase.storage
      .from(KNOWLEDGE_BUCKET)
      .upload(storagePath, buffer, {
        contentType: "application/pdf",
        upsert: false,
      });
    if (!error) filePath = storagePath;
  }

  await prisma.knowledgeDocument.create({
    data: {
      title,
      content: text,
      sourceType: "pdf",
      filePath,
    },
  });
  revalidatePath("/admin");
}

export async function deleteMeetingForm(formData: FormData) {
  await assertDashboard();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.meeting.delete({ where: { id } });
  revalidatePath("/admin");
}

const MAX_LEAD_TEXT = 100_000;

export async function deleteLeadForm(formData: FormData) {
  await assertDashboard();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.lead.delete({ where: { id } });
  revalidatePath("/admin");
}

export async function updateLeadForm(formData: FormData) {
  await assertDashboard();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const name = String(formData.get("name") ?? "").trim() || null;
  const rawEmail = String(formData.get("email") ?? "").trim();
  let email: string | null = null;
  if (rawEmail) {
    const ok = z.string().email().safeParse(rawEmail);
    if (!ok.success) return;
    email = rawEmail;
  }
  let intent = String(formData.get("intent") ?? "");
  let summary = String(formData.get("summary") ?? "");
  if (intent.length > MAX_LEAD_TEXT) intent = intent.slice(0, MAX_LEAD_TEXT);
  if (summary.length > MAX_LEAD_TEXT) summary = summary.slice(0, MAX_LEAD_TEXT);

  await prisma.lead.update({
    where: { id },
    data: {
      name,
      email,
      intent: intent.trim() || null,
      summary: summary.trim() || null,
    },
  });
  revalidatePath("/admin");
}

const MAX_MEETING_NOTES = 50_000;

export async function updateMeetingForm(formData: FormData) {
  await assertDashboard();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const title = String(formData.get("title") ?? "").trim();
  const startIso = String(formData.get("startAtIso") ?? "").trim();
  const endIso = String(formData.get("endAtIso") ?? "").trim();
  if (!title || !startIso || !endIso) return;
  const startAt = parseBookMeetingIsoToUtc(startIso);
  const endAt = parseBookMeetingIsoToUtc(endIso);
  if (!startAt || !endAt || endAt.getTime() <= startAt.getTime()) return;

  let notes = String(formData.get("notes") ?? "");
  if (notes.length > MAX_MEETING_NOTES) notes = notes.slice(0, MAX_MEETING_NOTES);
  const locationDetail =
    String(formData.get("locationDetail") ?? "").trim() || null;
  const mt = String(formData.get("meetingType") ?? "").trim();
  const meetingType = ["google_meet", "zoom", "phone", "other"].includes(mt)
    ? mt
    : null;
  const attendeeName = String(formData.get("attendeeName") ?? "").trim() || null;
  const rawAttEmail = String(formData.get("attendeeEmail") ?? "").trim();
  let attendeeEmail: string | null = null;
  if (rawAttEmail) {
    const ok = z.string().email().safeParse(rawAttEmail);
    attendeeEmail = ok.success ? rawAttEmail : null;
  }

  await prisma.meeting.update({
    where: { id },
    data: {
      title,
      startAt,
      endAt,
      notes: notes.trim() || null,
      locationDetail,
      meetingType,
      attendeeName,
      attendeeEmail,
    },
  });
  revalidatePath("/admin");
}

const MAX_INSTRUCTION_CHARS = 12_000;

export async function saveCustomerInstructions(formData: FormData) {
  await assertDashboard();
  let text = String(formData.get("customerInstructions") ?? "");
  if (text.length > MAX_INSTRUCTION_CHARS) {
    text = text.slice(0, MAX_INSTRUCTION_CHARS);
  }
  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO "AgentSettings" ("id", "customerInstructions", "updatedAt")
      VALUES (${AGENT_SETTINGS_ID}, ${text}, NOW())
      ON CONFLICT ("id") DO UPDATE SET
        "customerInstructions" = EXCLUDED."customerInstructions",
        "updatedAt" = NOW()
    `
  );
  revalidatePath("/admin");
}

export async function saveCustomerLocale(formData: FormData) {
  await assertDashboard();
  const raw = String(formData.get("customerLocale") ?? "");
  const locale = normalizeCustomerLocale(raw);
  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO "AgentSettings" ("id", "customerInstructions", "customerLocale", "updatedAt")
      VALUES (${AGENT_SETTINGS_ID}, '', ${locale}, NOW())
      ON CONFLICT ("id") DO UPDATE SET
        "customerLocale" = EXCLUDED."customerLocale",
        "updatedAt" = NOW()
    `
  );
  revalidatePath("/admin");
  revalidatePath("/chat");
  revalidatePath("/call");
}
