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
    <div className="min-h-screen w-full bg-slate-200 p-4 md:p-6 lg:p-8">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-6xl overflow-hidden rounded-3xl bg-slate-100 shadow-2xl md:min-h-[calc(100vh-3rem)] lg:min-h-[calc(100vh-4rem)]">

        {/* ─── Left panel: image ─────────────────────────────── */}
        <div className="relative hidden flex-1 md:block">
          <img
            src={BACKGROUND_IMAGE}
            alt="Orbis fleet"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950/70 via-slate-900/50 to-slate-950/80" />

          <div className="relative z-10 flex h-full flex-col justify-between p-8 text-white">
            <div className="flex items-center gap-2">
              <div className="grid size-10 place-items-center rounded-lg bg-white text-sm font-bold text-slate-900">
                OR
              </div>
              <div>
                <p className="font-semibold leading-tight">Orbis Logistics</p>
                <p className="text-xs text-white/70">Operations, yard control & security</p>
              </div>
            </div>

            <div className="max-w-sm">
              <h2 className="text-3xl font-bold leading-tight">
                Border freight, tracked end to end.
              </h2>
              <p className="mt-3 text-sm text-white/80">
                Sulphur out, copper back. Every truck, load and shilling accounted
                for — from the yard to the customer's gate.
              </p>
            </div>

            <p className="text-xs text-white/60">
              © {new Date().getFullYear()} Orbis Logistics. All rights reserved.
            </p>
          </div>
        </div>

        {/* ─── Right panel: modern black glass card on grey ──── */}
        <div className="relative flex flex-1 items-center justify-center bg-slate-100 p-6 sm:p-10 lg:p-12">
          <div className="w-full max-w-sm rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-black p-8 shadow-2xl ring-1 ring-white/5">
            {/* Mobile-only brand */}
            <div className="mb-6 flex items-center gap-2 md:hidden">
              <div className="grid size-10 place-items-center rounded-full bg-white/10 text-sm font-bold text-white shadow-inner">
                OR
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight text-white">Orbis Logistics</p>
                <p className="text-[11px] text-white/50">Operations, yard control & security</p>
              </div>
            </div>

            {/* Desktop brand mark */}
            <div className="mb-6 hidden justify-center md:flex">
              <div className="grid size-12 place-items-center rounded-full bg-white/10 text-sm font-bold text-white shadow-lg ring-1 ring-white/10">
                OR
              </div>
            </div>

            <h2 className="text-center text-2xl font-semibold text-white">
              Welcome back
            </h2>
            <p className="mt-2 text-center text-xs text-white/50">
              Sign in to your operations dashboard
            </p>

            <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
              <input
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="Email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrorMsg(null);
                }}
                required
                className="w-full rounded-xl bg-white/10 px-5 py-3 text-sm text-white placeholder-white/40 shadow-inner outline-none ring-1 ring-white/5 transition focus:ring-2 focus:ring-white/30"
              />
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMsg(null);
                }}
                required
                minLength={6}
                className="w-full rounded-xl bg-white/10 px-5 py-3 text-sm text-white placeholder-white/40 shadow-inner outline-none ring-1 ring-white/5 transition focus:ring-2 focus:ring-white/30"
              />

              {errorMsg ? (
                <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  {errorMsg}
                </p>
              ) : null}

              <hr className="my-1 border-white/10" />

              <button
                type="submit"
                disabled={busy || !ready}
                className="w-full rounded-full bg-white/10 px-5 py-3 text-sm font-medium text-white shadow transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Please wait…" : "Sign in"}
              </button>
            </form>

            <p className="mt-6 text-center text-[11px] leading-relaxed text-white/40">
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
