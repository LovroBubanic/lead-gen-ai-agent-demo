type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export function rateLimit(
  req: Request,
  scope: string,
  opts: { limit: number; windowMs: number }
): Response | null {
  const now = Date.now();
  const key = `${scope}:${clientIp(req)}`;
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return null;
  }

  current.count += 1;
  if (current.count <= opts.limit) return null;

  const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
  return Response.json(
    { error: "Too many requests. Please try again shortly." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
      },
    }
  );
}

export function isContentType(req: Request, expected: string): boolean {
  return req.headers
    .get("content-type")
    ?.toLowerCase()
    .startsWith(expected.toLowerCase()) ?? false;
}
