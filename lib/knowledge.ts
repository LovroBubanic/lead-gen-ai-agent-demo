import { prisma } from "@/lib/prisma";
import { asImagePathList } from "@/lib/listing-images";

const MAX_CHARS = 12_000;

/** Demo RAG: inject owner documents into the system prompt (no vector DB). */
export async function buildKnowledgeContext(): Promise<string> {
  const docs = await prisma.knowledgeDocument.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  if (docs.length === 0) {
    return "No knowledge base documents yet. Answer helpfully and offer to connect the visitor with the team.";
  }
  const blocks = docs.map((d) => {
    const tag = d.sourceType === "pdf" ? " [PDF]" : "";
    const paths = asImagePathList(d.imagePaths);
    const photoLine =
      paths.length > 0
        ? `\n[Listing photos: ${paths.length} image(s) on file — knowledgeDocumentId="${d.id}". When the visitor asks to see the property or photos, call showListingImage with knowledgeDocumentId "${d.id}" (optional imageIndex 0–${paths.length - 1}).]`
        : "";
    return `### ${d.title}${tag}${photoLine}\n${d.content.trim()}`;
  });
  let text = blocks.join("\n\n---\n\n");
  if (text.length > MAX_CHARS) {
    text = text.slice(0, MAX_CHARS) + "\n\n[Truncated for demo]";
  }
  return text;
}
