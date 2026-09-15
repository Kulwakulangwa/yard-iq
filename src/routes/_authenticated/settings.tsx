import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/orbis/AppShell";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Orbis Logistics" }] }),
  component: Settings,
});

const db = supabase as never as { from: (t: string) => any };

const SETTING_KEYS = [
  { key: "company_name", label: "Company name", type: "text" },
  { key: "default_currency", label: "Default currency", type: "text" },
  { key: "usd_tzs_rate", label: "USD to TZS exchange rate", type: "number" },
  { key: "fuel_variance_tolerance_percent", label: "Fuel variance tolerance (%)", type: "number" },
  { key: "auto_approve_low_variance", label: "Auto-approve low variance", type: "boolean" },
  { key: "require_gate_photo", label: "Require gate photo", type: "boolean" },
  { key: "maintenance_release_requires_security", label: "Maintenance release requires security sign-off", type: "boolean" },
];

function Settings() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<string, string | number | boolean>>({});

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["app_settings"],
    queryFn: async () => {
      const { data, error } = await db.from("app_settings").select("*");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      for (const s of SETTING_KEYS) {
        const val = draft[s.key];
        const existing = rows.find((r) => r.key === s.key);
        const payload = {
          key: s.key,
          label: s.label,
          value: val === undefined ? (existing?.value ?? "") : String(val),
          value_type: s.type,
        };
        if (existing) {
          const { error } = await db.from("app_settings").update(payload).eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await db.from("app_settings").insert(payload);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app_settings"] });
      toast.success("Settings saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function currentValue(key: string, type: string) {
    if (draft[key] !== undefined) return draft[key];
    const row = rows.find((r) => r.key === key);
    if (type === "boolean") return row?.value === "true" || row?.value === true;
    if (type === "number") return row?.value ?? "";
    return row?.value ?? "";
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="Application-wide configuration" />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <Card className="p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {SETTING_KEYS.map((s) => (
              <div key={s.key} className={s.type === "boolean" ? "flex items-center gap-3" : undefined}>
                <Label className={s.type === "boolean" ? "mb-0" : "mb-1.5 block text-xs text-muted-foreground"}>
                  {s.label}
                </Label>
                {s.type === "boolean" ? (
                  <input
                    type="checkbox"
                    className="size-4 rounded border-input"
                    checked={Boolean(currentValue(s.key, s.type))}
                    onChange={(e) => setDraft((d) => ({ ...d, [s.key]: e.target.checked }))}
                  />
                ) : (
                  <Input
                    type={s.type === "number" ? "number" : "text"}
                    value={String(currentValue(s.key, s.type))}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        [s.key]: s.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value,
                      }))
                    }
                  />
                )}
              </div>
            ))}
          </div>
          <div className="mt-5">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save settings"}
            </Button>
          </div>
        </Card>
      )}
    </>
  );
}
