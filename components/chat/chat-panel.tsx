"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Mic,
  Phone,
  Send,
  Square,
  Volume2,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  useMemo,
  useRef,
  useEffect,
  useCallback,
  useState,
} from "react";
import type { UIMessage } from "ai";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { GradientText } from "@/components/ui/gradient-text";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getCustomerUiMessages } from "@/lib/customer-ui-messages";
import type { VisitorPaletteId } from "@/lib/visitor-ui-palettes";

type ChatMessageMetadata = {
  voicePlaybackUrl?: string;
};

type AppUIMessage = UIMessage<ChatMessageMetadata>;

function messageText(m: AppUIMessage): string {
  return m.parts
    .filter(
      (p): p is { type: "text"; text: string } =>
        p.type === "text" && typeof (p as { text?: string }).text === "string"
    )
    .map((p) => p.text)
    .join("");
}

type ShowListingResult =
  | {
      ok: true;
      imageUrl: string;
      title: string;
      imageIndex: number;
      totalImages: number;
    }
  | { ok: false; error: string };

function isShowListingOutput(v: unknown): v is ShowListingResult {
  if (!v || typeof v !== "object" || !("ok" in v)) return false;
  const o = v as { ok: boolean };
  if (o.ok) {
    return (
      typeof (o as { imageUrl?: string }).imageUrl === "string" &&
      typeof (o as { title?: string }).title === "string"
    );
  }
  return typeof (o as { error?: string }).error === "string";
}

function AssistantMessageBody({
  message,
  showTyping,
}: {
  message: AppUIMessage;
  showTyping: boolean;
}) {
  const parts = message.parts ?? [];
  if (parts.length === 0) {
    const t = messageText(message);
    if (t) return <>{t}</>;
    return showTyping ? (
      <span className="inline-flex items-center gap-2 text-[var(--muted)]">
        <TypingDots />
      </span>
    ) : (
      "\u00a0"
    );
  }

  return (
    <>
      {parts.map((part, i) => {
        if (part.type === "text" && "text" in part) {
          return <span key={i}>{part.text}</span>;
        }
        if (part.type === "tool-showListingImage" && "state" in part) {
          const st = part as { state: string; output?: unknown };
          if (st.state === "output-available" && isShowListingOutput(st.output)) {
            if (st.output.ok) {
              return (
                <div key={i} className="mt-3 space-y-1.5 first:mt-0">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                    {st.output.title}
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={st.output.imageUrl}
                    alt={st.output.title}
                    className="max-h-72 w-full rounded-xl border border-[var(--border)] object-cover shadow-md"
                  />
                </div>
              );
            }
            return (
              <p key={i} className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                {st.output.error}
              </p>
            );
          }
        }
        return null;
      })}
      {!messageText(message) && showTyping ? (
        <span className="inline-flex items-center gap-2 text-[var(--muted)]">
          <TypingDots />
        </span>
      ) : null}
    </>
  );
}

function pickRecorderMime(): string | undefined {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
  ];
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return undefined;
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 px-0.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-[var(--muted)]"
          animate={{ y: [0, -4, 0], opacity: [0.5, 1, 0.5] }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </span>
  );
}

export function ChatPanel({
  locale,
  visitorPalette,
}: {
  locale: string;
  visitorPalette: VisitorPaletteId;
}) {
  const t = useMemo(() => getCustomerUiMessages(locale), [locale]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const [recording, setRecording] = useState(false);
  const [transcribingVoice, setTranscribingVoice] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat" }),
    []
  );
  const { messages, sendMessage, status, error, clearError } =
    useChat<AppUIMessage>({
      transport,
    });

  const busy =
    status === "streaming" || status === "submitted" || transcribingVoice;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  const stopMediaTracks = useCallback((rec: MediaRecorder | null) => {
    rec?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  const startRecording = useCallback(async () => {
    setVoiceError(null);
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setVoiceError(t.voiceNotSupported);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickRecorderMime();
      const rec = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      setVoiceError(t.micRequired);
    }
  }, [t]);

  const cancelRecording = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec) return;
    if (rec.state !== "inactive") {
      rec.onstop = null;
      rec.stop();
    }
    stopMediaTracks(rec);
    recorderRef.current = null;
    chunksRef.current = [];
    setRecording(false);
  }, [stopMediaTracks]);

  const finishRecordingToBlob = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const rec = recorderRef.current;
      if (!rec || rec.state === "inactive") {
        resolve(null);
        return;
      }
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: rec.mimeType || "audio/webm",
        });
        stopMediaTracks(rec);
        recorderRef.current = null;
        chunksRef.current = [];
        resolve(blob.size > 0 ? blob : null);
      };
      rec.stop();
    });
  }, [stopMediaTracks]);

  const sendVoiceMessage = useCallback(async () => {
    if (!recording || transcribingVoice) return;
    setRecording(false);
    setVoiceError(null);
    setTranscribingVoice(true);
    try {
      const blob = await finishRecordingToBlob();
      if (!blob) {
        setVoiceError(t.noAudio);
        return;
      }
      const fd = new FormData();
      fd.append("audio", blob, "voice.webm");
      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error || t.transcriptionFailed);
      }
      const text =
        data.text && data.text.length > 0
          ? data.text
          : t.noSpeech;
      const voicePlaybackUrl = URL.createObjectURL(blob);
      await sendMessage({
        text,
        metadata: { voicePlaybackUrl },
      });
    } catch (e) {
      setVoiceError(e instanceof Error ? e.message : t.voiceFailed);
    } finally {
      setTranscribingVoice(false);
    }
  }, [finishRecordingToBlob, recording, sendMessage, transcribingVoice, t]);

  useEffect(() => {
    return () => {
      cancelRecording();
    };
  }, [cancelRecording]);

  const last = messages[messages.length - 1];
  const assistantThinking =
    busy &&
    last?.role === "user" &&
    (last ? messageText(last).length > 0 : false);

  const paletteProps =
    visitorPalette !== "default"
      ? ({ "data-ui-palette": visitorPalette } as const)
      : {};

  return (
    <div className="h-[100dvh] max-h-[100dvh] min-h-0" {...paletteProps}>
      <AuroraBackground className="h-[100dvh] max-h-[100dvh] min-h-0 text-[var(--foreground)]">
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        className="sticky top-0 z-20 border-b border-[var(--border)]/70 bg-[var(--surface)]/70 px-4 py-3 shadow-[0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl"
      >
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <div className="leading-tight">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em]">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/35 bg-emerald-500/15 px-2 py-0.5 text-emerald-800 shadow-sm dark:border-emerald-400/40 dark:bg-emerald-500/20 dark:text-emerald-200">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-70 dark:bg-emerald-400" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                </span>
                {t.onlineBadge}
              </span>
            </p>
            <p className="text-[15px] font-semibold tracking-tight">
              {t.liveChatHeader}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/call"
              className="group inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)]/60 px-3 py-1.5 text-xs font-medium text-[var(--muted)] backdrop-blur-sm transition hover:border-[var(--primary)]/40 hover:text-[var(--foreground)]"
            >
              <Phone className="h-3.5 w-3.5 transition-transform group-hover:-rotate-12" aria-hidden />
              {t.voiceCallLink}
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </motion.header>

      <main className="relative mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col overflow-hidden px-3 pb-40 pt-4 sm:px-4 sm:pt-5">
        <AnimatePresence initial={false}>
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 overflow-y-auto overscroll-y-contain px-1 py-6 text-center sm:gap-6 sm:py-8"
            >
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                <GradientText animated>{t.heroTitle}</GradientText>
              </h2>
              <p className="max-w-md text-balance text-sm leading-relaxed text-[var(--muted)]">
                {t.heroSub}
              </p>
              <div className="mt-1 flex w-full max-w-lg flex-col items-center gap-2.5 sm:mt-2">
                <p className="text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground)]">
                  {t.tapSuggestion}
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
                  {[t.suggestion1, t.suggestion2, t.suggestion3].map((s, i) => (
                    <motion.button
                      key={s}
                      type="button"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 + i * 0.05 }}
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => void sendMessage({ text: s })}
                      disabled={busy}
                      className="inline-flex w-full items-center justify-center rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3 text-center text-sm font-medium leading-snug text-[var(--foreground)] shadow-md backdrop-blur-md transition hover:border-[var(--primary)]/50 hover:bg-[var(--surface-muted)] disabled:opacity-50 sm:w-auto sm:min-w-0 sm:rounded-full sm:px-4 sm:py-2.5"
                    >
                      {s}
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {messages.length > 0 ? (
          <div
            className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-y-contain pt-1 [-webkit-overflow-scrolling:touch]"
          >
            <AnimatePresence initial={false}>
              {messages.map((m) => {
                const isUser = m.role === "user";
                const isLast = m.id === messages[messages.length - 1]?.id;
                const showAssistantTyping = Boolean(
                  busy && m.role === "assistant" && isLast && !messageText(m)
                );
                return (
                  <motion.div
                    key={m.id}
                    layout
                    initial={{ opacity: 0, y: 10, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 420, damping: 30 }}
                    className={`flex items-end gap-2 ${
                      isUser ? "justify-end" : "justify-start"
                    }`}
                  >
                    <motion.div
                      layout
                      whileHover={{ y: -1 }}
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 35,
                      }}
                      className={`relative max-w-[86%] rounded-[1.4rem] px-4 py-2.5 text-[15px] leading-relaxed shadow-md ${
                        isUser
                          ? "bg-[linear-gradient(135deg,#6366f1,#8b5cf6)] text-white shadow-[0_12px_30px_-12px_rgba(99,102,241,0.7)]"
                          : "border border-[var(--border)]/80 bg-[var(--surface)]/90 text-[var(--foreground)] backdrop-blur-xl"
                      }`}
                    >
                      {isUser && m.metadata?.voicePlaybackUrl ? (
                        <div className="mb-2 flex items-center gap-2 text-xs font-medium opacity-90">
                          <Volume2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          <span>{t.voiceMessage}</span>
                        </div>
                      ) : null}
                      {isUser && m.metadata?.voicePlaybackUrl ? (
                        <audio
                          controls
                          src={m.metadata.voicePlaybackUrl}
                          className="mb-2 h-9 w-full max-w-full rounded-lg opacity-95 [&::-webkit-media-controls-panel]:bg-black/10"
                        />
                      ) : null}
                      <div className="whitespace-pre-wrap break-words">
                        {isUser ? (
                          messageText(m) || "\u00a0"
                        ) : (
                          <AssistantMessageBody
                            message={m}
                            showTyping={showAssistantTyping}
                          />
                        )}
                      </div>
                      <span
                        aria-hidden
                        className={`pointer-events-none absolute bottom-0 ${
                          isUser ? "-right-1" : "-left-1"
                        } h-3 w-3 rotate-45 rounded-sm ${
                          isUser
                            ? "bg-[linear-gradient(135deg,#8b5cf6,#6366f1)]"
                            : "border-b border-r border-[var(--border)]/80 bg-[var(--surface)]/90"
                        }`}
                      />
                    </motion.div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {assistantThinking ? (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 flex justify-start pl-1"
                aria-live="polite"
              >
                <div className="flex items-center gap-2 rounded-full border border-[var(--border)]/80 bg-[var(--surface)]/85 px-3 py-1.5 text-xs text-[var(--muted)] shadow-sm backdrop-blur-md">
                  <TypingDots />
                  <span>{t.typing}</span>
                </div>
              </motion.div>
            ) : null}

            <div ref={bottomRef} className="h-px w-full shrink-0" aria-hidden />
          </div>
        ) : null}
      </main>

      {voiceError && (
        <div className="fixed bottom-28 left-0 right-0 z-20 px-4">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto flex max-w-2xl items-center justify-between gap-2 rounded-2xl border border-amber-500/35 bg-[color-mix(in_oklab,#f59e0b_18%,var(--surface))] px-3 py-2 text-sm text-[color-mix(in_oklab,#92400e_80%,var(--foreground))] shadow-lg dark:bg-amber-950/80 dark:text-amber-50"
          >
            <span className="min-w-0 flex-1">{voiceError}</span>
            <button
              type="button"
              onClick={() => setVoiceError(null)}
              className="shrink-0 rounded-lg bg-amber-500/20 px-2 py-1 text-xs font-medium"
            >
              {t.ok}
            </button>
          </motion.div>
        </div>
      )}

      {error && (
        <div className="fixed bottom-28 left-0 right-0 z-20 px-4">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto flex max-w-2xl items-center justify-between gap-2 rounded-2xl border border-red-500/40 bg-[color-mix(in_oklab,#ef4444_12%,var(--surface))] px-3 py-2 text-sm text-[color-mix(in_oklab,#991b1b_80%,var(--foreground))] shadow-lg dark:bg-red-950/80 dark:text-red-100"
          >
            <span className="min-w-0 flex-1 truncate">{t.chatRequestFailed}</span>
            <button
              type="button"
              onClick={() => clearError()}
              className="shrink-0 rounded-lg bg-red-500/20 px-2 py-1 text-xs font-medium"
            >
              {t.dismiss}
            </button>
          </motion.div>
        </div>
      )}

      <motion.footer
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="fixed bottom-0 left-0 right-0 z-10 border-t border-[var(--border)]/70 bg-[var(--surface)]/80 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl"
      >
        <div className="mx-auto flex max-w-2xl flex-col gap-2">
          <AnimatePresence initial={false}>
            {recording ? (
              <motion.div
                key="rec"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center justify-between gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2 font-medium text-red-600 dark:text-red-300">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                  </span>
                  {t.recording}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={cancelRecording}
                    disabled={transcribingVoice}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted)] transition hover:bg-[var(--surface-muted)] disabled:opacity-40"
                    aria-label={t.ariaCancel}
                  >
                    <X className="h-5 w-5" />
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    type="button"
                    onClick={() => void sendVoiceMessage()}
                    disabled={transcribingVoice}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-white shadow-md transition hover:bg-red-500 disabled:opacity-50"
                    aria-label={t.ariaStopVoice}
                  >
                    <Square className="h-4 w-4 fill-current" />
                  </motion.button>
                </div>
              </motion.div>
            ) : transcribingVoice ? (
              <motion.div
                key="trans"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]/80 px-3 py-2.5 text-sm text-[var(--muted)]"
              >
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--primary)]" />
                {t.transcribing}
              </motion.div>
            ) : null}
          </AnimatePresence>

          <form
            className="flex items-center gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const input = form.elements.namedItem(
                "message"
              ) as HTMLInputElement;
              const text = input.value.trim();
              if (!text || busy) return;
              input.value = "";
              await sendMessage({ text });
            }}
          >
            <div
              className={`relative flex h-12 flex-1 items-center overflow-hidden rounded-full border bg-[var(--surface)]/90 transition focus-within:border-[var(--primary)]/60 focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] ${
                busy ? "opacity-60" : ""
              } border-[var(--border)]`}
            >
              <input
                name="message"
                autoComplete="off"
                placeholder={t.placeholder}
                disabled={busy || recording}
                className="peer h-full w-full bg-transparent px-4 text-[15px] text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]/70 disabled:cursor-not-allowed"
              />
            </div>
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              whileHover={{ y: -1 }}
              onClick={() => {
                if (busy || recording) return;
                void startRecording();
              }}
              disabled={busy || recording}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)]/90 text-[var(--foreground)] shadow-sm transition hover:border-[var(--primary)]/50 hover:bg-[var(--surface-muted)] disabled:opacity-50"
              aria-label={t.ariaRecord}
            >
              <Mic className="h-5 w-5" />
            </motion.button>
            <motion.button
              type="submit"
              whileTap={{ scale: 0.92 }}
              whileHover={{ y: -1 }}
              disabled={busy || recording}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#6366f1,#8b5cf6)] text-white shadow-[0_12px_30px_-12px_rgba(99,102,241,0.7)] transition hover:brightness-110 disabled:opacity-50"
              aria-label={t.ariaSend}
            >
              {busy && !recording ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </motion.button>
          </form>
        </div>
      </motion.footer>
    </AuroraBackground>
    </div>
  );
}
