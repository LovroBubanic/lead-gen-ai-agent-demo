export function asImagePathList(v: unknown): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) {
    return v.filter((x): x is string => typeof x === "string");
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((x): x is string => typeof x === "string");
    } catch {
      return [];
    }
  }
  return [];
}

/** Persist listing image URLs/paths as JSON in SQLite (`KnowledgeDocument.imagePaths`). */
export function imagePathsToDb(paths: string[]): string | null {
  if (!paths.length) return null;
  return JSON.stringify(paths);
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
