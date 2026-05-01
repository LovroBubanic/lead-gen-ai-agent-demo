"use client";

import { motion } from "framer-motion";
import { Loader2, Phone, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { OPENAI_REALTIME_VOICE_OPTIONS } from "@/lib/openai-realtime-voices";

type VoiceForCallsFormProps = {
  defaultVoice: string;
  customerLocale: string;
  saveAction: (formData: FormData) => void | Promise<void>;
};

export function VoiceForCallsForm({
  defaultVoice,
  customerLocale,
  saveAction,
}: VoiceForCallsFormProps) {
  const [selectedVoice, setSelectedVoice] = useState(defaultVoice);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const objectUrlRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setSelectedVoice(defaultVoice);
  }, [defaultVoice]);

  useEffect(
    () => () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      audioRef.current?.pause();
      audioRef.current = null;
    },
    []
  );

  const playPreview = useCallback(async () => {
    setPreviewBusy(true);
    setPreviewError(false);
    try {
      const res = await fetch("/api/admin/voice-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voice: selectedVoice,
          language: customerLocale,
        }),
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const blob = await res.blob();
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;

      audioRef.current?.pause();
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        if (objectUrlRef.current === url) {
          URL.revokeObjectURL(url);
          objectUrlRef.current = null;
        }
      };
      await audio.play();
    } catch {
      setPreviewError(true);
      window.setTimeout(() => setPreviewError(false), 3200);
    } finally {
      setPreviewBusy(false);
    }
  }, [customerLocale, selectedVoice]);

  return (
    <form action={saveAction} className="flex flex-col gap-3 p-5">
      <label className="flex flex-col gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
          Voice for calls
        </span>
        <select
          name="realtimeVoice"
          value={selectedVoice}
          onChange={(e) => setSelectedVoice(e.target.value)}
          className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none ring-[var(--primary)]/40 transition focus:ring-2"
        >
          {OPENAI_REALTIME_VOICE_OPTIONS.map((voice) => (
            <option key={voice.id} value={voice.id}>
              {voice.label}
            </option>
          ))}
        </select>
      </label>
      <p className="text-[11px] text-[var(--muted)]">
        Used for OpenAI Realtime calls via your{" "}
        <code className="rounded bg-[var(--surface-muted)] px-1">
          OPENAI_API_KEY
        </code>
        . Preview uses the same voice names with short text in your visitor
        language.
      </p>
      {previewError ? (
        <p className="text-[11px] text-red-600 dark:text-red-400" role="alert">
          Preview failed — check the API key and try again.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          whileHover={{ y: -1 }}
          disabled={previewBusy}
          onClick={() => void playPreview()}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] shadow-sm transition hover:bg-[var(--surface)] disabled:opacity-50"
        >
          {previewBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Play className="h-4 w-4" aria-hidden />
          )}
          Preview voice
        </motion.button>
        <motion.button
          type="submit"
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-5 py-2.5 text-sm font-semibold text-[var(--foreground)] shadow-sm transition hover:bg-[var(--surface)]"
        >
          <Phone className="h-4 w-4" aria-hidden />
          Save voice
        </motion.button>
      </div>
    </form>
  );
}
