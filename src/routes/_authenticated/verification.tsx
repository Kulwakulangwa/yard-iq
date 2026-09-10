import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { logAudit, nextReference } from "@/lib/orbis";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/orbis/AppShell";
import { StatusBadge } from "@/components/orbis/StatusBadge";

export const Route = createFileRoute("/_authenticated/verification")({
  head: () => ({ meta: [{ title: "Load Verification — Orbis Logistics" }] }),
  component: Verification,
});

const db = supabase as never as { from: (t: string) => any };

async function raiseException(input: {
  type: string;
  expected: string;
  actual: string;
  loadId?: string;
  tripId?: string;
  vehicleId?: string;
  severity?: string;
  reason?: string;
}) {
  const { data: existing } = await db.from("exceptions").select("exception_number");
  const number = nextReference(
    "EXC",
    ((existing ?? []) as any[]).map((e) => String(e.exception_number ?? "")),
  );
  await db.from("exceptions").insert({
    exception_number: number,
    exception_type: input.type,
    expected_value: input.expected,
    actual_value: input.actual,
    load_id: input.loadId ?? null,
    trip_id: input.tripId ?? null,
    vehicle_id: input.vehicleId ?? null,
    severity: input.severity ?? "Medium",
    status: "Open",
    reason: input.reason ?? null,
    required_approver: "Operations Manager",
  });
  return number;
}

function Verification() {
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  const { data: loads = [] } = useQuery({
    queryKey: ["loads"],
    queryFn: async () => {
      const { data } = await db.from("loads").select("*").order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  const submit = useMutation({
    mutationFn: async (load: any) => {
      const actualQty = form["actual_quantity"] === "" ? null : Number(form["actual_quantity"]);
      const actualWeight = form["actual_weight"] === "" ? null : Number(form["actual_weight"]);
      const actualSeal = form["actual_seal_number"] || null;

      const { error } = await db
        .from("loads")
        .update({
          actual_quantity: actualQty,
          actual_weight: actualWeight,
          actual_seal_number: actualSeal,
          loading_officer: form["loading_officer"] || null,
          verification_officer: form["verification_officer"] || null,
          variance_reason: form["variance_reason"] || null,
          status: "Verified",
        })
        .eq("id", load.id);
      if (error) throw error;
      await logAudit("load_verified", "loads", load.id, form);

      const raised: string[] = [];
      if (actualQty !== null && Number(load.expected_quantity ?? 0) !== actualQty) {
        raised.push(
          await raiseException({
            type: "Cargo Quantity Mismatch",
            expected: String(load.expected_quantity ?? "—"),
            actual: String(actualQty),
            loadId: load.id,
            tripId: load.trip_id,
            severity: "High",
            reason: form["variance_reason"] || undefined,
          }),
        );
      }
      if (actualWeight !== null && Number(load.expected_weight ?? 0) !== actualWeight) {
        raised.push(
          await raiseException({
            type: "Cargo Weight Mismatch",
            expected: String(load.expected_weight ?? "—"),
            actual: String(actualWeight),
            loadId: load.id,
            tripId: load.trip_id,
            severity: "Medium",
          }),
        );
      }
      if (actualSeal && load.seal_number && actualSeal !== load.seal_number) {
        raised.push(
          await raiseException({
            type: "Seal Mismatch",
            expected: String(load.seal_number),
            actual: actualSeal,
            loadId: load.id,
            tripId: load.trip_id,
            severity: "Critical",
          }),
        );
      }
      return raised;
    },
    onSuccess: (raised) => {
      qc.invalidateQueries({ queryKey: ["loads"] });
      qc.invalidateQueries({ queryKey: ["exceptions"] });
      setOpenId(null);
      setForm({});
      toast.success(raised.length ? `Verified — ${raised.length} exception(s) raised` : "Load verified, no variance");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pending = loads.filter((l) => !["Reconciled", "Delivered"].includes(l.status));

  return (
    <>
      <PageHeader title="Load Verification" subtitle="Record what was actually loaded against what was planned" />

      <div className="space-y-3">
        {pending.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">No loads waiting.</Card>
        ) : (
          pending.map((l) => (
            <Card key={l.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{l.load_reference}</span>
                <span className="text-sm text-muted-foreground">{l.cargo_description}</span>
                <StatusBadge value={l.status} />
              </div>
              <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
                <p>
                  Expected qty: <strong>{l.expected_quantity ?? "—"}</strong> {l.unit_of_measure ?? ""}
                </p>
                <p>
                  Expected weight: <strong>{l.expected_weight ?? "—"}</strong>
                </p>
                <p>
                  Seal: <strong>{l.seal_number ?? "—"}</strong>
                </p>
              </div>

              {openId === l.id ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {[
                    ["actual_quantity", "Actual quantity", "number"],
                    ["actual_weight", "Actual weight", "number"],
                    ["actual_seal_number", "Actual seal number", "text"],
                    ["loading_officer", "Loading officer", "text"],
                    ["verification_officer", "Verification officer", "text"],
                  ].map(([key, label, type]) => (
                    <div key={key}>
                      <Label className="mb-1.5 block text-xs text-muted-foreground">{label}</Label>
                      <Input
                        type={type}
                        value={form[key] ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      />
                    </div>
                  ))}
                  <div className="sm:col-span-2">
                    <Label className="mb-1.5 block text-xs text-muted-foreground">Variance reason</Label>
                    <Textarea
                      value={form["variance_reason"] ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, variance_reason: e.target.value }))}
                    />
                  </div>
                  <div className="flex gap-2 sm:col-span-2">
                    <Button onClick={() => submit.mutate(l)} disabled={submit.isPending}>
                      Submit verification
                    </Button>
                    <Button variant="outline" onClick={() => setOpenId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    setOpenId(l.id);
                    setForm({});
                  }}
                >
                  Verify load
                </Button>
              )}
            </Card>
          ))
        )}
      </div>
    </>
  );
}
