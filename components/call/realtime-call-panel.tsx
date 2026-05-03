"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Loader2,
  MessageSquare,
  Volume2,
  VolumeX,
  Activity,
} from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createHighpassChain,
  getBrowserMicConstraints,
  isIOSSafari,
} from "@/lib/realtime/webrtc-helpers";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { AudioVisualizer } from "@/components/ui/audio-visualizer";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import type { CustomerUiMessages } from "@/lib/customer-ui-messages";
import { getCustomerUiMessages } from "@/lib/customer-ui-messages";
import { localeLabel, normalizeCustomerLocale } from "@/lib/locales";
import { normalizeOpenAIRealtimeVoice } from "@/lib/openai-realtime-voices";

type Phase = "idle" | "connecting" | "live" | "error";

type FunctionCallItem = {
  call_id: string;
  name: string;
  arguments: string;
};

// Locked session defaults — no user-facing controls.
const MIC_PROFILE = "far_field";
const VAD_MODE = "semantic";

function pushCall(
  calls: FunctionCallItem[],
  seen: Set<string>,
  call_id: string,
  name: string,
  args: unknown
) {
  if (seen.has(call_id)) return;
  seen.add(call_id);
  calls.push({
    call_id,
    name,
    arguments: typeof args === "string" ? args : JSON.stringify(args ?? {}),
  });
}

function collectFromItem(
  item: unknown,
  calls: FunctionCallItem[],
  seen: Set<string>
) {
  if (!item || typeof item !== "object") return;
  const o = item as Record<string, unknown>;
  const t = o.type;
  if (t === "function_call" || t === "function_call_item") {
    const call_id =
      (typeof o.call_id === "string" && o.call_id) ||
      (typeof o.id === "string" && o.id) ||
      (typeof o.callId === "string" && o.callId) ||
      "";
    const name = typeof o.name === "string" ? o.name : "";
    const args = o.arguments ?? o.args;
    if (call_id && name) {
      pushCall(calls, seen, call_id, name, args);
    }
    return;
  }
  for (const v of Object.values(o)) {
    if (v && typeof v === "object") {
      if (Array.isArray(v)) {
        for (const el of v) collectFromItem(el, calls, seen);
      } else {
        collectFromItem(v, calls, seen);
      }
    }
  }
}

function extractFunctionCalls(msg: Record<string, unknown>): FunctionCallItem[] {
  const calls: FunctionCallItem[] = [];
  const seen = new Set<string>();
  collectFromItem(msg, calls, seen);
  return calls;
}

function formatPhase(phase: Phase, m: CustomerUiMessages): string {
  switch (phase) {
    case "idle":
      return m.phaseReady;
    case "connecting":
      return m.phaseConnecting;
    case "live":
      return m.phaseLive;
    case "error":
      return m.phaseError;
  }
}

function mapConnectError(raw: string, m: CustomerUiMessages): string {
  if (raw === "No microphone audio track.") return m.errorNoMic;
  if (raw === "ICE gathering timed out") return m.errorIceTimeout;
  if (raw === "Missing local SDP") return m.errorMissingSdp;
  if (raw === "Data channel error") return m.errorDataChannel;
  return raw || m.errorCouldNotStart;
}

function CallTimer({ phase }: { phase: Phase }) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);
  useEffect(() => {
    if (phase !== "live") {
      startRef.current = null;
      setElapsed(0);
      return;
    }
    startRef.current = Date.now();
    const id = setInterval(() => {
      if (startRef.current !== null) {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      }
    }, 500);
    return () => clearInterval(id);
  }, [phase]);
  if (phase !== "live") return null;
  const mm = Math.floor(elapsed / 60)
    .toString()
    .padStart(2, "0");
  const ss = (elapsed % 60).toString().padStart(2, "0");
  return (
    <span className="font-mono text-xs text-[color-mix(in_oklab,var(--foreground)_72%,var(--muted))]">
      {mm}:{ss}
    </span>
  );
}

export function RealtimeCallPanel({
  locale,
  voice,
}: {
  locale: string;
  voice: string;
}) {
  const t = useMemo(() => getCustomerUiMessages(locale), [locale]);
  const visitorLangCode = useMemo(
    () => normalizeCustomerLocale(locale),
    [locale]
  );
  const visitorLangName = useMemo(
    () => localeLabel(visitorLangCode),
    [visitorLangCode]
  );
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const [remoteMuted, setRemoteMuted] = useState(false);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const rawStreamRef = useRef<MediaStream | null>(null);
  const sendStreamRef = useRef<MediaStream | null>(null);
  const senderTrackRef = useRef<MediaStreamTrack | null>(null);
  const disposeHpfRef = useRef<(() => void) | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const initialGreetingRequestedRef = useRef(false);
  const waitingForInitialGreetingRef = useRef(false);

  const processToolCalls = useCallback(
    async (calls: FunctionCallItem[]) => {
      const dc = dcRef.current;
      if (!dc || dc.readyState !== "open") return;
      for (const call of calls) {
        try {
          const res = await fetch("/api/realtime/tool", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: call.name,
              arguments: call.arguments,
            }),
          });
          const raw = await res.text();
          let data: { output?: string } = {};
          try {
            data = JSON.parse(raw) as { output?: string };
          } catch {
            data = { output: raw };
          }
          if (!res.ok) {
            const errMsg = `Tool API ${res.status}: ${raw.slice(0, 200)}`;
            setError(t.voiceToolFailed);
            dc.send(
              JSON.stringify({
                type: "conversation.item.create",
                item: {
                  type: "function_call_output",
                  call_id: call.call_id,
                  output: JSON.stringify({
                    ok: false,
                    error: errMsg,
                  }),
                },
              })
            );
            continue;
          }
          const output =
            typeof data.output === "string"
              ? data.output
              : JSON.stringify(data);
          let parsed: { ok?: boolean; error?: unknown } = {};
          try {
            parsed = JSON.parse(output) as { ok?: boolean; error?: unknown };
          } catch {
            /* output may be non-JSON */
          }
          if (parsed.ok === false) {
            setError(t.voiceDashboardSaveFailed);
          }
          dc.send(
            JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: call.call_id,
                output,
              },
            })
          );
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : "Tool failed";
          setError(t.voiceToolFailed);
          dc.send(
            JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: call.call_id,
                output: JSON.stringify({
                  ok: false,
                  error: errMsg,
                }),
              },
            })
          );
        }
      }
      dc.send(JSON.stringify({ type: "response.create" }));
    },
    [setError, t]
  );

  const teardown = useCallback(() => {
    try {
      dcRef.current?.close();
    } catch {
      /* ignore */
    }
    dcRef.current = null;
    try {
      pcRef.current?.getSenders().forEach((s) => {
        try {
          s.track?.stop();
        } catch {
          /* ignore */
        }
      });
      pcRef.current?.close();
    } catch {
      /* ignore */
    }
    pcRef.current = null;
    rawStreamRef.current?.getTracks().forEach((t) => t.stop());
    rawStreamRef.current = null;
    sendStreamRef.current = null;
    senderTrackRef.current = null;
    disposeHpfRef.current?.();
    disposeHpfRef.current = null;
    void ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    setMicStream(null);
    setMicMuted(false);
    setPhase("idle");
    initialGreetingRequestedRef.current = false;
    waitingForInitialGreetingRef.current = false;
  }, []);

  useEffect(() => () => teardown(), [teardown]);

  // Apply mute state to outgoing track whenever it toggles.
  useEffect(() => {
    const tr = senderTrackRef.current;
    if (!tr) return;
    tr.enabled = !micMuted && !waitingForInitialGreetingRef.current;
  }, [micMuted]);

  const playRemoteAudio = useCallback(() => {
    const el = remoteAudioRef.current;
    if (!el || remoteMuted) return;
    el.muted = false;
    el.volume = 1;
    void el.play().catch(() => {});
  }, [remoteMuted]);

  const requestInitialGreeting = useCallback(() => {
    const dc = dcRef.current;
    if (
      !dc ||
      dc.readyState !== "open" ||
      initialGreetingRequestedRef.current
    ) {
      return;
    }
    initialGreetingRequestedRef.current = true;
    playRemoteAudio();
    dc.send(
      JSON.stringify({
        type: "response.create",
        response: {
          instructions: `Start the call now. For this turn, speak ONLY in ${visitorLangName} (ISO 639-1: ${visitorLangCode}). Do not use any other language. Give a brief natural hello, then invite the caller to speak.`,
        },
      })
    );
  }, [playRemoteAudio, visitorLangCode, visitorLangName]);

  const handleServerEvent = useCallback(
    (raw: string) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return;
      }
      const type = String(msg.type ?? "");

      if (type === "error") {
        const err = msg.error as { message?: string } | undefined;
        setError(err?.message ?? t.errorRealtime);
        return;
      }

      if (type === "input_audio_buffer.speech_started") {
        const el = remoteAudioRef.current;
        if (el && !remoteMuted) {
          el.pause();
        }
        try {
          if (dcRef.current?.readyState === "open") {
            dcRef.current.send(
              JSON.stringify({ type: "output_audio_buffer.clear" })
            );
          }
        } catch {
          /* ignore */
        }
      }

      if (
        type === "response.created" ||
        type === "response.output_item.added" ||
        type === "response.audio.delta" ||
        type === "output_audio_buffer.started"
      ) {
        playRemoteAudio();
      }

      if (type === "response.done" || type === "response.completed") {
        if (waitingForInitialGreetingRef.current) {
          waitingForInitialGreetingRef.current = false;
          const tr = senderTrackRef.current;
          if (tr) tr.enabled = !micMuted;
        }
        const calls = extractFunctionCalls(msg);
        if (calls.length > 0) {
          void processToolCalls(calls);
          return;
        }
        playRemoteAudio();
      }
    },
    [micMuted, playRemoteAudio, processToolCalls, remoteMuted, t]
  );

  const connectCall = useCallback(async () => {
    setError(null);
    setPhase("connecting");

    const iosSafari = isIOSSafari();
    const useHpf = !iosSafari;

    try {
      const AC =
        globalThis.AudioContext ??
        (globalThis as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AC) {
        const ctx = new AC({ latencyHint: "interactive" });
        ctxRef.current = ctx;
        await ctx.resume().catch(() => {});
      }

      const raw = await navigator.mediaDevices.getUserMedia({
        audio: getBrowserMicConstraints(),
        video: false,
      });
      rawStreamRef.current = raw;
      setMicStream(raw);

      let sendStream = raw;
      if (useHpf) {
        const chain = createHighpassChain(raw, 110);
        if (chain) {
          sendStream = chain.outStream;
          disposeHpfRef.current = chain.dispose;
        }
      }
      sendStreamRef.current = sendStream;
      const outTrack = sendStream.getAudioTracks()[0];
      if (!outTrack) throw new Error("No microphone audio track.");
      senderTrackRef.current = outTrack;
      waitingForInitialGreetingRef.current = true;
      initialGreetingRequestedRef.current = false;
      outTrack.enabled = false;

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        iceCandidatePoolSize: 0,
      });
      pcRef.current = pc;

      pc.ontrack = (ev) => {
        const el = remoteAudioRef.current;
        if (!el) return;
        const [stream] = ev.streams;
        el.srcObject = stream;
        el.muted = remoteMuted;
        el.volume = remoteMuted ? 0 : 1;
        el.setAttribute("playsinline", "");
        playRemoteAudio();
      };

      const dc = pc.createDataChannel("oai-events", { ordered: true });
      dcRef.current = dc;
      dc.onopen = requestInitialGreeting;
      dc.onmessage = (ev) => handleServerEvent(String(ev.data));
      dc.onerror = () => setError(t.errorDataChannel);

      pc.addTrack(outTrack, sendStream);

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });
      await pc.setLocalDescription(offer);

      await new Promise<void>((resolve, reject) => {
        if (pc.iceGatheringState === "complete") {
          resolve();
          return;
        }
        const iceTimer = window.setTimeout(
          () => reject(new Error("ICE gathering timed out")),
          8000
        );
        const onIce = () => {
          if (pc.iceGatheringState === "complete") {
            window.clearTimeout(iceTimer);
            pc.removeEventListener("icegatheringstatechange", onIce);
            resolve();
          }
        };
        pc.addEventListener("icegatheringstatechange", onIce);
      }).catch(() => {});

      const local = pc.localDescription;
      if (!local?.sdp) throw new Error("Missing local SDP");

      const qs = new URLSearchParams({
        mic: MIC_PROFILE,
        vad: VAD_MODE,
        voice: normalizeOpenAIRealtimeVoice(voice),
      });
      const res = await fetch(`/api/realtime/calls?${qs.toString()}`, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: local.sdp,
      });
      const answerSdp = await res.text();
      if (!res.ok) {
        throw new Error(answerSdp || `Call setup failed (${res.status})`);
      }

      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
      requestInitialGreeting();
      setPhase("live");
    } catch (e) {
      teardown();
      setPhase("error");
      setError(
        mapConnectError(
          e instanceof Error ? e.message : "",
          t
        )
      );
    }
  }, [handleServerEvent, playRemoteAudio, remoteMuted, requestInitialGreeting, teardown, t, voice]);

  useEffect(() => {
    const el = remoteAudioRef.current;
    if (!el) return;
    el.muted = remoteMuted;
    el.volume = remoteMuted ? 0 : 1;
  }, [remoteMuted]);

  const isLive = phase === "live";
  const isConnecting = phase === "connecting";
  const isIdle = phase === "idle";
  const isError = phase === "error";

  const statusChipClass =
    isLive || isIdle
      ? "border-emerald-500/40 bg-emerald-500/[0.14] text-emerald-950 dark:border-emerald-400/35 dark:bg-emerald-500/15 dark:text-emerald-100"
      : isConnecting
        ? "border-amber-500/40 bg-amber-500/12 text-amber-950 dark:border-amber-400/35 dark:bg-amber-500/12 dark:text-amber-50"
        : isError
          ? "border-red-500/40 bg-red-500/12 text-red-950 dark:border-red-400/35 dark:bg-red-500/12 dark:text-red-50"
          : "border-[var(--border)] bg-[var(--surface)]/60 text-[var(--foreground)]";

  return (
    <AuroraBackground className="min-h-[100dvh] text-[var(--foreground)]">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-20 border-b border-[var(--border)]/70 bg-[var(--surface)]/70 px-4 py-3 backdrop-blur-xl"
      >
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <p className="text-[15px] font-semibold tracking-tight">
            {t.callHeader}
          </p>
          <div className="flex items-center gap-2">
            <Link
              href="/chat"
              className="group inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)]/60 px-3 py-1.5 text-xs font-medium text-[var(--muted)] backdrop-blur-sm transition hover:border-[var(--primary)]/40 hover:text-[var(--foreground)]"
            >
              <MessageSquare
                className="h-3.5 w-3.5 transition-transform group-hover:-rotate-6"
                aria-hidden
              />
              {t.callLinkChat}
            </Link>
            <div
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold backdrop-blur-sm ${statusChipClass}`}
            >
              <span
                className={`relative inline-flex h-2 w-2 shrink-0 items-center justify-center rounded-full ${
                  isLive || isIdle
                    ? "bg-emerald-500"
                    : isConnecting
                      ? "bg-amber-500"
                      : isError
                        ? "bg-red-500"
                        : "bg-[var(--muted)]"
                }`}
              >
                {isLive || isIdle ? (
                  <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/80 dark:bg-emerald-300/70" />
                ) : isConnecting ? (
                  <span className="absolute inset-0 animate-pulse rounded-full bg-amber-400/60" />
                ) : null}
              </span>
              <span className="max-w-[11rem] truncate sm:max-w-none">
            {formatPhase(phase, t)}
              </span>
              <CallTimer phase={phase} />
            </div>
            <ThemeToggle />
          </div>
        </div>
      </motion.header>

      <main className="relative mx-auto flex w-full max-w-2xl flex-1 items-center justify-center px-4 pb-44 pt-6">
        <motion.div
          layout
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className="flex flex-col items-center gap-8"
        >
          <div className="relative">
            <AnimatePresence>
              {isLive ? (
                <motion.span
                  key="ring"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-full"
                  style={{
                    boxShadow:
                      "0 0 80px 12px rgba(99,102,241,0.35), 0 0 140px 30px rgba(168,85,247,0.25)",
                  }}
                />
              ) : null}
            </AnimatePresence>
            <motion.div
              animate={
                isLive
                  ? { scale: [1, 1.03, 1], rotate: [0, 2, 0] }
                  : { scale: 1, rotate: 0 }
              }
              transition={{
                duration: 4.5,
                repeat: isLive ? Infinity : 0,
                ease: "easeInOut",
              }}
              className="relative flex h-52 w-52 items-center justify-center rounded-full sm:h-60 sm:w-60"
              style={{
                background:
                  "conic-gradient(from 120deg at 50% 50%, #6366f1, #a855f7, #22d3ee, #ec4899, #6366f1)",
                filter: "blur(0.5px)",
              }}
            >
              <div className="absolute inset-[6px] rounded-full bg-[var(--background)]/90 shadow-inner" />
              <div className="absolute inset-[10px] overflow-hidden rounded-full">
                {isLive && micStream ? (
                  <AudioVisualizer
                    stream={micStream}
                    active={!micMuted}
                    bars={20}
                    className="px-6 py-8"
                    color="var(--primary)"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <motion.span
                      animate={{ scale: [1, 1.08, 1] }}
                      transition={{
                        duration: 2.4,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      <Activity className="h-10 w-10" />
                    </motion.span>
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--foreground)]">
              {isLive
                ? micMuted
                  ? t.statusMuted
                  : t.statusActive
                : isConnecting
                  ? t.statusSetup
                  : isError
                    ? t.statusRetry
                    : t.statusReady}
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              {t.callHero}
            </h2>
          </div>
        </motion.div>
      </main>

      {error ? (
        <div className="fixed bottom-36 left-0 right-0 z-20 px-4">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto max-w-md rounded-xl border border-red-500/35 bg-[color-mix(in_oklab,#ef4444_12%,var(--surface))] px-3 py-2 text-center text-sm text-[color-mix(in_oklab,#991b1b_80%,var(--foreground))] shadow-lg dark:bg-red-950/70 dark:text-red-100"
          >
            {error}
          </motion.div>
        </div>
      ) : null}

      <audio
        ref={remoteAudioRef}
        className="hidden"
        autoPlay
        playsInline
        controls={false}
      />

      <motion.footer
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed bottom-0 left-0 right-0 z-10 border-t border-[var(--border)]/70 bg-[var(--surface)]/85 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl"
      >
        <div className="mx-auto flex max-w-2xl items-center justify-center">
          {phase === "idle" || phase === "error" ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              whileHover={{ y: -1 }}
              onClick={() => void connectCall()}
              className="relative inline-flex h-16 items-center justify-center gap-2.5 overflow-hidden rounded-full bg-[linear-gradient(135deg,#10b981,#22c55e)] px-10 text-base font-semibold text-white shadow-[0_18px_50px_-18px_rgba(16,185,129,0.7)] transition hover:brightness-110"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute -inset-y-2 -left-1/2 w-1/3 rotate-12 bg-gradient-to-r from-transparent via-white/45 to-transparent blur-sm [animation:sweep_2.6s_ease-in-out_infinite]"
              />
              <Phone className="relative h-5 w-5" aria-hidden />
              <span className="relative">{t.startCall}</span>
              <style jsx>{`
                @keyframes sweep {
                  0% {
                    transform: translateX(-140%) rotate(12deg);
                  }
                  60%,
                  100% {
                    transform: translateX(380%) rotate(12deg);
                  }
                }
              `}</style>
            </motion.button>
          ) : null}

          {phase === "connecting" ? (
            <div className="inline-flex h-16 items-center justify-center gap-2.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)]/80 px-8 text-sm font-medium text-[var(--foreground)]">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              {t.connectingLabel}
            </div>
          ) : null}

          {phase === "live" ? (
            <div className="flex items-center gap-6">
              <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={() => setMicMuted((m) => !m)}
                aria-pressed={micMuted}
                aria-label={micMuted ? t.ariaUnmuteMic : t.ariaMuteMic}
                className={`flex h-14 w-14 items-center justify-center rounded-full border transition ${
                  micMuted
                    ? "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]"
                    : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--foreground)]"
                }`}
              >
                {micMuted ? (
                  <MicOff className="h-5 w-5" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </motion.button>

              <motion.button
                type="button"
                whileTap={{ scale: 0.94 }}
                whileHover={{ y: -1 }}
                onClick={() => {
                  teardown();
                  setError(null);
                }}
                aria-label={t.ariaEndCall}
                className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-700 text-white shadow-[0_18px_44px_-12px_rgba(239,68,68,0.7)] transition hover:brightness-110"
              >
                <PhoneOff className="h-7 w-7" />
              </motion.button>

              <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={() => setRemoteMuted((m) => !m)}
                aria-pressed={remoteMuted}
                aria-label={remoteMuted ? t.ariaUnmuteSpeaker : t.ariaMuteSpeaker}
                className={`flex h-14 w-14 items-center justify-center rounded-full border transition ${
                  remoteMuted
                    ? "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]"
                    : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--foreground)]"
                }`}
              >
                {remoteMuted ? (
                  <VolumeX className="h-5 w-5" />
                ) : (
                  <Volume2 className="h-5 w-5" />
                )}
              </motion.button>
            </div>
          ) : null}
        </div>
      </motion.footer>
    </AuroraBackground>
  );
}
