import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/orbis/AppShell";
import { StatusBadge } from "@/components/orbis/StatusBadge";

export const Route = createFileRoute("/_authenticated/maintenance-handover")({
  head: () => ({ meta: [{ title: "Maintenance Handover — Orbis Logistics" }] }),
  component: MaintenanceHandover,
});

const db = supabase as never as { from: (t: string) => any };

function MaintenanceHandover() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["work_orders"],
    queryFn: async () => {
      const { data, error } = await db.from("work_orders").select("*, vehicles(*)").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const release = useMutation({
    mutationFn: async (order: any) => {
      if (!form[`verifier_${order.id}`]) {
        throw new Error("A yard supervisor or security verifier is required before release.");
      }
      const { error } = await db
        .from("work_orders")
        .update({
          status: "Released",
          released_verified_by: form[`verifier_${order.id}`],
          handover_condition: form[`notes_${order.id}`] || null,
        })
        .eq("id", order.id);
      if (error) throw error;

      await db
        .from("vehicles")
        .update({ status: "Available", yard_zone: "Parking" })
        .eq("id", order.vehicle_id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work_orders"] });
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      setSelected(null);
      toast.success("Vehicle released from workshop");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openOrders = orders.filter((o) => !["Released", "Completed"].includes(o.status));

  return (
    <>
      <PageHeader
        title="Maintenance Handover"
        subtitle="Record workshop condition and release vehicles back to the yard"
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : openOrders.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">No open work orders.</Card>
      ) : (
        <div className="space-y-3">
          {openOrders.map((o) => (
            <Card key={o.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{o.work_order_number}</span>
                <StatusBadge value={o.status} />
                <span className="text-sm text-muted-foreground">
                  {o.vehicles?.registration_number ?? "—"}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{o.reported_defect}</p>

              {selected === o.id ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label className="mb-1.5 block text-xs text-muted-foreground">Work completed / condition notes</Label>
                    <Textarea
                      value={form[`notes_${o.id}`] ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, [`notes_${o.id}`]: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-xs text-muted-foreground">Yard / security verifier</Label>
                    <Input
                      value={form[`verifier_${o.id}`] ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, [`verifier_${o.id}`]: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-xs text-muted-foreground">Release odometer</Label>
                    <Input
                      type="number"
                      value={form[`odometer_${o.id}`] ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, [`odometer_${o.id}`]: e.target.value }))}
                    />
                  </div>
                  <div className="flex gap-2 sm:col-span-2">
                    <Button onClick={() => release.mutate(o)} disabled={release.isPending}>
                      Release to yard
                    </Button>
                    <Button variant="outline" onClick={() => setSelected(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" className="mt-3" onClick={() => setSelected(o.id)}>
                  Handover / release
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
