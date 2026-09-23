import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

const BACKGROUND_IMAGE =
  "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=2400&q=80";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Orbis Logistics Operations" },
      {
        name: "description",
        content: "Sign in to Orbis to manage trips, loads, yard control and security accountability.",
      },
      { property: "og:title", content: "Sign in — Orbis Logistics" },
      { property: "og:description", content: "Staff access to the Orbis logistics and yard control system." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setReady(true);
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrorMsg(null);
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });
      if (error) throw error;
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      const message = (err as Error).message;
      setErrorMsg(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-[#0a0a0a] px-4 py-8">
      {/* Ambient gradient glows for depth — no bright anything */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/3 left-1/4 h-[500px] w-[500px] rounded-full bg-orange-500/5 blur-[120px]" />
        <div className="absolute -bottom-1/3 right-1/4 h-[500px] w-[500px] rounded-full bg-blue-500/5 blur-[120px]" />
      </div>

      <div className="relative z-10 flex w-full max-w-5xl overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0f0f10] shadow-[0_8px_60px_-15px_rgba(0,0,0,0.8)]">

        {/* ─── Left panel: image ─────────────────────────────── */}
        <div className="relative hidden flex-1 md:block">
          <img
            src={BACKGROUND_IMAGE}
            alt="Orbis fleet"
            className="absolute inset-0 h-full w-full object-cover opacity-90"
          />
          {/* Heavy dark overlay — keeps the image subtle, not bright */}
          <div className="absolute inset-0 bg-gradient-to-br from-black/90 via-[#0a0a0a]/85 to-black/95" />

          <div className="relative z-10 flex h-full flex-col justify-between p-10 text-white">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-md border border-orange-500/30 bg-orange-500/10 text-sm font-bold text-orange-400">
                OR
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight text-white">
                  Orbis Logistics
                </p>
                <p className="text-[11px] text-white/40">
                  Operations · Yard Control · Security
                </p>
              </div>
            </div>

            <div className="max-w-sm">
              <div className="mb-6 h-px w-16 bg-orange-500/60" />
              <h2 className="text-[28px] font-semibold leading-tight tracking-tight text-white">
                Every truck, load and shilling — accounted for.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-white/50">
                Sulphur out, copper back. Cross-border freight with full
                yard control, load verification, and driver accountability.
              </p>
            </div>

            <p className="text-[11px] text-white/30">
              © {new Date().getFullYear()} Orbis Logistics
            </p>
          </div>
        </div>

        {/* ─── Right panel: dark sign-in form ────────────────── */}
        <div className="flex flex-1 flex-col justify-center bg-[#0f0f10] p-8 sm:p-12 lg:p-14">
          {/* Mobile-only brand */}
          <div className="mb-8 flex items-center gap-3 md:hidden">
            <div className="grid size-10 place-items-center rounded-md border border-orange-500/30 bg-orange-500/10 text-sm font-bold text-orange-400">
              OR
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight text-white">
                Orbis Logistics
              </p>
              <p className="text-[11px] text-white/40">Operations · Yard · Security</p>
            </div>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Sign in
            </h1>
            <p className="mt-2 text-sm text-white/40">
              Access your operations dashboard
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="you@company.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrorMsg(null);
                }}
                required
                className="w-full rounded-lg border border-white/[0.08] bg-[#161618] px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-orange-500/40 focus:bg-[#1a1a1c] focus:ring-2 focus:ring-orange-500/10"
              />
            </div>

            <div>
              <label
                htmlFor="pw"
                className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40"
              >
                Password
              </label>
              <input
                id="pw"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMsg(null);
                }}
                required
                minLength={6}
                className="w-full rounded-lg border border-white/[0.08] bg-[#161618] px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-orange-500/40 focus:bg-[#1a1a1c] focus:ring-2 focus:ring-orange-500/10"
              />
            </div>

            {errorMsg ? (
              <div className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-xs text-red-400">
                {errorMsg}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={busy || !ready}
              className="mt-2 w-full rounded-lg bg-orange-500 px-4 py-3 text-sm font-semibold text-black shadow-lg shadow-orange-500/20 transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="mt-8 border-t border-white/[0.06] pt-6">
            <p className="text-[11px] leading-relaxed text-white/30">
              Accounts are created by your administrator.
              <br />
              Contact your manager if you need access.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
