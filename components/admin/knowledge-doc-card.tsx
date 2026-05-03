"use client";

import {
  BookOpen,
  FileText,
  Image as ImageIcon,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import type { SerializedKnowledge } from "@/components/admin/types";

type KnowledgeDocCardProps = {
  doc: SerializedKnowledge;
  deleteKnowledgeForm: (formData: FormData) => void | Promise<void>;
  updateKnowledgeDocument: (formData: FormData) => void | Promise<void>;
  supabaseConfigured: boolean;
  onAfterMutation?: () => void;
};

export function KnowledgeDocCard({
  doc,
  deleteKnowledgeForm,
  updateKnowledgeDocument,
  supabaseConfigured,
  onAfterMutation,
}: KnowledgeDocCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const dialogTitleId = useId();

  const [editOpen, setEditOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const [draftTitle, setDraftTitle] = useState(doc.title);
  const [draftContent, setDraftContent] = useState(doc.content);
  const [filesDirty, setFilesDirty] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (editOpen) {
      setDraftTitle(doc.title);
      setDraftContent(doc.content);
      setFilesDirty(false);
    }
  }, [editOpen, doc.title, doc.content]);

  useEffect(() => {
    if (!editOpen) {
      setDraftTitle(doc.title);
      setDraftContent(doc.content);
    }
  }, [doc.title, doc.content, editOpen]);

  const refreshAfter = useCallback(
    (fn: (fd: FormData) => void | Promise<void>) =>
      async (formData: FormData) => {
        await fn(formData);
        startTransition(() => {
          router.refresh();
          onAfterMutation?.();
        });
      },
    [router, onAfterMutation]
  );

  const editDirty =
    editOpen &&
    (draftTitle.trim() !== doc.title.trim() ||
      draftContent.trim() !== doc.content.trim() ||
      filesDirty);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (lightboxUrl) {
        setLightboxUrl(null);
      } else if (editOpen) {
        setEditOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editOpen, lightboxUrl]);

  const portal =
    mounted && typeof document !== "undefined" ? document.body : null;

  return (
    <>
        <div className="mb-3 flex min-w-0 items-start gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
              {doc.sourceType === "pdf" ? (
                <FileText className="h-4 w-4" />
              ) : (
                <BookOpen className="h-4 w-4" />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                {doc.sourceType === "pdf" ? "PDF" : "Text note"}
              </p>
              <h3 className="truncate text-sm font-semibold">{doc.title}</h3>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-muted)]/80 px-2 py-1 text-[11px] font-medium text-[var(--foreground)] transition hover:border-[var(--primary)]/40 hover:bg-[var(--surface)]"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
            <form action={refreshAfter(deleteKnowledgeForm)}>
              <input type="hidden" name="id" value={doc.id} />
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-1 text-[11px] font-medium text-[var(--muted)] transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </button>
            </form>
          </div>
        </div>

        <p className="max-h-44 overflow-hidden whitespace-pre-wrap text-sm text-[var(--muted)]">
          {doc.content.length > 480
            ? doc.content.slice(0, 480) + "…"
            : doc.content}
        </p>

        {doc.filePath ? (
          <p className="mt-3 text-[11px] text-[var(--muted)]">
            Stored: {doc.filePath}
          </p>
        ) : null}

        {doc.imageCount > 0 ? (
          <div className="mt-3 space-y-2">
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              <ImageIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {doc.imageCount} listing photo{doc.imageCount === 1 ? "" : "s"}{" "}
              — tap to view
            </p>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: doc.imageCount }, (_, idx) => {
                const src = `/api/knowledge/image/${doc.id}/${idx}`;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setLightboxUrl(src)}
                    className="relative h-16 w-16 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] shadow-sm transition hover:ring-2 hover:ring-[var(--primary)]/40"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

      {portal && editOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
              role="presentation"
            >
              <button
                type="button"
                aria-label="Close dialog"
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={() => setEditOpen(false)}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={dialogTitleId}
                className="relative z-[101] flex max-h-[90vh] w-full max-w-lg flex-col gap-4 overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-elevated)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-2">
                  <h2
                    id={dialogTitleId}
                    className="text-lg font-semibold tracking-tight"
                  >
                    Edit knowledge
                  </h2>
                  <button
                    type="button"
                    onClick={() => setEditOpen(false)}
                    className="rounded-full p-1.5 text-[var(--muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {editDirty ? (
                  <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-900 dark:text-amber-100">
                    Unsaved changes — click Save to apply.
                  </p>
                ) : null}

                <form
                  action={async (formData) => {
                    await updateKnowledgeDocument(formData);
                    startTransition(() => {
                      setEditOpen(false);
                      router.refresh();
                      onAfterMutation?.();
                    });
                  }}
                  className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto"
                >
                  <input type="hidden" name="id" value={doc.id} />
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                      Title
                    </span>
                    <input
                      name="title"
                      required
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm outline-none ring-[var(--primary)]/40 transition focus:ring-2"
                    />
                  </label>
                  <label className="flex min-h-0 flex-col gap-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                      Content
                    </span>
                    <textarea
                      name="content"
                      required
                      value={draftContent}
                      onChange={(e) => setDraftContent(e.target.value)}
                      rows={10}
                      className="min-h-[200px] w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm outline-none ring-[var(--primary)]/40 transition focus:ring-2"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                      Add listing photos (optional)
                    </span>
                    <input
                      type="file"
                      name="images"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      multiple
                      onChange={() => setFilesDirty(true)}
                      className="block w-full text-sm text-[var(--muted)] file:mr-3 file:rounded-lg file:border file:border-[var(--border)] file:bg-[var(--surface)] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[var(--foreground)]"
                    />
                    <span className="text-[11px] text-[var(--muted)]">
                      Appends up to the per-document limit. Requires Supabase (
                      <code className="rounded bg-[var(--surface-muted)] px-1">
                        SUPABASE_SERVICE_ROLE_KEY
                      </code>
                      ).
                    </span>
                  </label>
                  {!supabaseConfigured ? (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400">
                      Storage not configured — photo uploads are disabled until
                      Supabase is set up.
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={isPending}
                      className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#6366f1,#8b5cf6)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
                    >
                      Save changes
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditOpen(false)}
                      className="rounded-full border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--muted)] transition hover:bg-[var(--surface-muted)]"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            portal
          )
        : null}

      {portal && lightboxUrl
        ? createPortal(
            <div
              className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
              role="presentation"
            >
              <button
                type="button"
                aria-label="Close image"
                className="absolute inset-0"
                onClick={() => setLightboxUrl(null)}
              />
              <div className="relative z-[111] max-h-[90vh] max-w-[min(96vw,900px)]">
                <button
                  type="button"
                  onClick={() => setLightboxUrl(null)}
                  className="absolute -right-2 -top-12 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
                  aria-label="Close"
                >
                  <X className="h-6 w-6" />
                </button>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={lightboxUrl}
                  alt=""
                  className="max-h-[85vh] w-full rounded-2xl border border-white/20 object-contain shadow-2xl"
                />
              </div>
            </div>,
            portal
          )
        : null}
    </>
  );
}
