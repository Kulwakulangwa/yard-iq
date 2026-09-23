import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Full-screen truck image used as the auth background.
// Swap this URL for a branded photo if you prefer — any public image URL works.
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
    <div className="min-h-screen w-full bg-slate-950 p-4 md:p-6 lg:p-8">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-6xl overflow-hidden rounded-3xl bg-background shadow-2xl md:min-h-[calc(100vh-3rem)] lg:min-h-[calc(100vh-4rem)]">

        {/* ─── Left panel: image ─────────────────────────────── */}
        <div className="relative hidden flex-1 md:block">
          <img
            src={BACKGROUND_IMAGE}
            alt="Orbis fleet"
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* Dark gradient so brand text stays readable */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950/70 via-slate-900/50 to-slate-950/80" />

          {/* Brand overlay */}
          <div className="relative z-10 flex h-full flex-col justify-between p-8 text-white">
            <div className="flex items-center gap-2">
              <div className="grid size-10 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
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

        {/* ─── Right panel: form ─────────────────────────────── */}
        <div className="flex flex-1 flex-col justify-center p-6 sm:p-10 lg:p-12">
          {/* Mobile-only brand header */}
          <div className="mb-8 flex items-center gap-2 md:hidden">
            <div className="grid size-8 place-items-center rounded bg-primary text-xs font-bold text-primary-foreground">
              OR
            </div>
            <div>
              <p className="font-semibold leading-tight">Orbis Logistics</p>
              <p className="text-xs text-muted-foreground">Operations, yard control & security</p>
            </div>
          </div>

          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to continue to your operations dashboard.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-5">
            <div>
              <Label htmlFor="email" className="mb-1.5 block text-sm font-medium">
                Work email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder="you@company.com"
                className="h-11 rounded-xl"
                required
              />
            </div>

            <div>
              <Label htmlFor="pw" className="mb-1.5 block text-sm font-medium">
                Password
              </Label>
              <Input
                id="pw"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder="••••••••"
                className="h-11 rounded-xl"
                required
                minLength={6}
              />
            </div>

            {errorMsg ? (
              <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {errorMsg}
              </p>
            ) : null}

            <Button
              type="submit"
              className="h-11 w-full rounded-xl text-sm font-medium"
              disabled={busy || !ready}
            >
              {busy ? "Please wait…" : "Sign in"}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Accounts are created by your administrator. Contact your manager if you
            need access.
          </p>
        </div>
      </div>
    </div>
  );
}
