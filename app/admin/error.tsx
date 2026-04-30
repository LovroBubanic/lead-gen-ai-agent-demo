"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin] route error", error);
  }, [error]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-[var(--background)] px-4 text-center">
      <h1 className="text-lg font-semibold text-[var(--foreground)]">
        Something went wrong loading the owner dashboard
      </h1>
      <p className="max-w-md text-sm text-[var(--muted)]">
        Try again, or open the public chat. If this persists after deploy, check
        server logs and environment variables (database URLs, Prisma schema
        applied).
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium"
        >
          Try again
        </button>
        <Link
          href="/chat"
          className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium"
        >
          Open chat
        </Link>
      </div>
    </div>
  );
}
