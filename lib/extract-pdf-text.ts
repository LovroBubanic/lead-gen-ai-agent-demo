import "server-only";

/**
 * pdf-parse / pdfjs expect browser globals. Next/Vercel Node has no DOMMatrix until
 * we install a shim. Load shim + pdf-parse only when extracting (not on admin/login).
 */
async function ensurePdfGlobals() {
  if (typeof globalThis.DOMMatrix !== "undefined") return;
  const mod = await import("dommatrix");
  const Poly = mod.default;
  Object.assign(globalThis, { DOMMatrix: Poly });
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
  await ensurePdfGlobals();
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return (result.text ?? "").trim();
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}
