import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { asImagePathList, isHttpImageRef } from "@/lib/listing-images";
import { getSupabaseServiceRole } from "@/lib/supabase-server";
import { rateLimit } from "@/lib/rate-limit";

const KNOWLEDGE_BUCKET = "knowledge-pdfs";
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

type RouteParams = { documentId: string; index: string };

export const runtime = "nodejs";

function contentTypeForPath(p: string): string {
  const lower = p.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

function allowedExternalImageHost(hostname: string): boolean {
  const configured = process.env.KNOWLEDGE_IMAGE_ALLOWED_HOSTS;
  const allowed = (configured || "picsum.photos,images.unsplash.com")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(hostname.toLowerCase());
}

async function fetchExternalImage(raw: string): Promise<Response> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  if (url.protocol !== "https:" || !allowedExternalImageHost(url.hostname)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const upstream = await fetch(url, { redirect: "follow" });
  if (!upstream.ok || !upstream.body) {
    return new NextResponse("File not found", { status: 404 });
  }

  const type = upstream.headers.get("content-type") || "";
  if (!type.toLowerCase().startsWith("image/")) {
    return new NextResponse("File not found", { status: 404 });
  }

  const len = Number(upstream.headers.get("content-length") || "0");
  if (len > MAX_IMAGE_BYTES) {
    return new NextResponse("Image too large", { status: 413 });
  }

  const buf = Buffer.from(await upstream.arrayBuffer());
  if (buf.byteLength > MAX_IMAGE_BYTES) {
    return new NextResponse("Image too large", { status: 413 });
  }

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<RouteParams> }
) {
  const limited = rateLimit(request, "knowledge-image", {
    limit: 120,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const { documentId, index } = await context.params;
  const i = Number.parseInt(index, 10);
  if (!documentId || Number.isNaN(i) || i < 0) {
    return new NextResponse("Not found", { status: 404 });
  }

  const doc = await prisma.knowledgeDocument.findUnique({
    where: { id: documentId },
  });
  if (!doc) {
    return new NextResponse("Not found", { status: 404 });
  }

  const paths = asImagePathList(doc.imagePaths);
  const raw = paths[i];
  if (raw == null) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (isHttpImageRef(raw)) {
    return fetchExternalImage(raw);
  }

  const supabase = getSupabaseServiceRole();
  if (!supabase) {
    return new NextResponse("Image storage not configured", { status: 503 });
  }

  const { data, error } = await supabase.storage
    .from(KNOWLEDGE_BUCKET)
    .download(raw);

  if (error || !data) {
    return new NextResponse("File not found", { status: 404 });
  }

  const buf = Buffer.from(await data.arrayBuffer());
  if (buf.byteLength > MAX_IMAGE_BYTES) {
    return new NextResponse("Image too large", { status: 413 });
  }

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": contentTypeForPath(raw),
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
