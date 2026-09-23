import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
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
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: cleanPassword,
          options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Account created. You can sign in now.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });
        if (error) throw error;
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (err) {
      const message = (err as Error).message;
      setErrorMsg(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="relative grid min-h-screen place-items-center overflow-hidden bg-slate-900 px-4"
      style={{
        backgroundImage: `url(${BACKGROUND_IMAGE})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      {/* Dark overlay so the card stays readable on any photo */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950/85 via-slate-900/75 to-slate-950/90" />

      {/* Content sits above the overlay */}
      <Card className="relative z-10 w-full max-w-sm border-white/10 bg-background/95 p-6 shadow-2xl backdrop-blur-sm">
        <div className="mb-5 flex items-center gap-2">
          <div className="grid size-8 place-items-center rounded bg-primary text-xs font-bold text-primary-foreground">
            OR
          </div>
          <div>
            <h1 className="font-semibold leading-tight">Orbis Logistics</h1>
            <p className="text-xs text-muted-foreground">Operations, yard control & security</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" ? (
            <div>
              <Label htmlFor="name" className="mb-1.5 block text-xs text-muted-foreground">
                Full name
              </Label>
              <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
          ) : null}
          <div>
            <Label htmlFor="email" className="mb-1.5 block text-xs text-muted-foreground">
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
              required
            />
          </div>
          <div>
            <Label htmlFor="pw" className="mb-1.5 block text-xs text-muted-foreground">
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
              required
              minLength={6}
            />
          </div>

          {errorMsg ? (
            <p className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {errorMsg}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={busy || !ready}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <button
          className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "No account yet? Create one" : "Already have an account? Sign in"}
        </button>
      </Card>
    </div>
  );
}
