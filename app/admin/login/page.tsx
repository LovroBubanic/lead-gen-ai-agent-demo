import Link from "next/link";
import { KeyRound, Lock, ShieldCheck } from "lucide-react";
import { loginWithGatewayToken } from "../actions";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { FadeIn } from "@/components/ui/fade-in";
import { GradientText } from "@/components/ui/gradient-text";
import { ShinyText } from "@/components/ui/shiny-text";

type Props = {
  searchParams: Promise<{ e?: string; next?: string }>;
};

export default async function AdminLoginPage({ searchParams }: Props) {
  const sp = await searchParams;
  const err = sp.e === "1";
  const next =
    sp.next && sp.next.startsWith("/admin") && !sp.next.startsWith("//")
      ? sp.next
      : "/admin";

  return (
    <AuroraBackground className="flex min-h-[100dvh] items-center justify-center px-4 py-10">
      <FadeIn className="w-full max-w-md">
        <div className="relative overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--surface)]/85 p-8 shadow-[var(--shadow-elevated)] backdrop-blur-xl">
          <div
            aria-hidden
            className="pointer-events-none absolute -left-16 -top-16 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.35),transparent_70%)] blur-2xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -bottom-16 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(168,85,247,0.35),transparent_70%)] blur-2xl"
          />

          <div className="relative flex items-center gap-2.5">
            <div className="leading-tight">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                <ShinyText>Private · client only</ShinyText>
              </p>
              <p className="text-sm font-semibold tracking-tight">
                Lead/Booking Agent · Dashboard
              </p>
            </div>
          </div>

          <h1 className="relative mt-5 text-2xl font-semibold tracking-tight">
            <GradientText>Gateway access</GradientText>
          </h1>
          <p className="relative mt-2 text-sm leading-relaxed text-[var(--muted)]">
            Enter the long{" "}
            <strong className="text-[var(--foreground)]">
              DASHBOARD_GATEWAY_TOKEN
            </strong>{" "}
            value from your server environment. Chat visitors never see this
            URL.
          </p>

          {err ? (
            <p
              className="relative mt-4 rounded-xl border border-red-500/40 bg-[color-mix(in_oklab,#ef4444_12%,var(--surface))] px-3 py-2 text-sm text-[color-mix(in_oklab,#991b1b_80%,var(--foreground))] dark:bg-red-950/40 dark:text-red-100"
              role="alert"
            >
              That token does not match the server configuration.
            </p>
          ) : null}

          <form
            action={loginWithGatewayToken}
            className="relative mt-6 flex flex-col gap-4"
          >
            <input type="hidden" name="next" value={next} />
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                Gateway token
              </span>
              <div className="group relative flex items-center overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] focus-within:border-[var(--primary)]/60 focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] transition">
                <span className="pl-3 text-[var(--muted)]">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  id="token"
                  name="token"
                  type="password"
                  autoComplete="off"
                  required
                  placeholder="Paste your gateway token"
                  className="w-full bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-[var(--muted)]/70"
                />
              </div>
            </label>
            <button
              type="submit"
              className="relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-[linear-gradient(135deg,#6366f1,#8b5cf6)] py-2.5 text-sm font-semibold text-white shadow-[0_18px_50px_-18px_rgba(99,102,241,0.7)] transition hover:brightness-110 focus-ring"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute -inset-y-2 -left-1/2 w-1/3 rotate-12 bg-gradient-to-r from-transparent via-white/35 to-transparent blur-sm [animation:sweep_2.6s_ease-in-out_infinite]"
              />
              <KeyRound className="relative h-4 w-4" />
              <span className="relative">Unlock dashboard</span>
              <style>{`
                @keyframes sweep {
                  0% { transform: translateX(-140%) rotate(12deg); }
                  60%,100% { transform: translateX(380%) rotate(12deg); }
                }
              `}</style>
            </button>
          </form>

          <div className="relative mt-6 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-5">
            <p className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              Timing-safe, HTTP-only session
            </p>
            <Link
              href="/chat"
              className="text-xs font-medium text-[var(--primary)] hover:underline"
            >
              ← Public chat
            </Link>
          </div>
        </div>
      </FadeIn>
    </AuroraBackground>
  );
}
