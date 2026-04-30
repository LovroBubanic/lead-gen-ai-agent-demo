import type { Prisma } from "@prisma/client";

export function asImagePathList(v: Prisma.JsonValue | null | undefined): string[] {
  if (v == null) return [];
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

export function isHttpImageRef(path: string): boolean {
  return path.startsWith("http://") || path.startsWith("https://");
}

/**
 * Public URL for chat UI: external URLs as-is, storage paths via app route.
 */
export function publicListingImageUrl(
  documentId: string,
  index: number,
  raw: string
): string {
  if (isHttpImageRef(raw)) return raw;
  return `/api/knowledge/image/${encodeURIComponent(documentId)}/${index}`;
}
