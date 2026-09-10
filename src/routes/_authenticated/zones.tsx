import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { logAudit, formatValue } from "@/lib/orbis";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/orbis/AppShell";
import { StatusBadge } from "@/components/orbis/StatusBadge";

export const Route = createFileRoute("/_authenticated/zones")({
  head: () => ({ meta: [{ title: "Yard Zones — Orbis Logistics" }] }),
  component: Zones,
});

const db = supabase as never as { from: (t: string) => any };

function Zones() {
  const qc = useQueryClient();
  const [moving, setMoving] = useState<any | null>(null);
  const [toZone, setToZone] = useState("");
  const [reason, setReason] = useState("");

  const { data } = useQuery({
    queryKey: ["yard-board"],
    queryFn: async () => {
      const [zones, vehicles, moves] = await Promise.all([
        db.from("yard_zones").select("*").order("name"),
        db.from("vehicles").select("*"),
        db.from("yard_movements").select("*").order("moved_at", { ascending: false }).limit(25),
      ]);
      return {
        zones: (zones.data ?? []) as any[],
        vehicles: (vehicles.data ?? []) as any[],
        moves: (moves.data ?? []) as any[],
      };
    },
  });

  const move = useMutation({
    mutationFn: async () => {
      if (!moving || !toZone) throw new Error("Choose a zone");
      const { error } = await db.from("yard_movements").insert({
        vehicle_id: moving.id,
        from_zone: moving.yard_zone ?? null,
        to_zone: toZone,
        reason: reason || null,
        moved_at: new Date().toISOString(),
      });
      if (error) throw error;
      const up = await db.from("vehicles").update({ yard_zone: toZone }).eq("id", moving.id);
      if (up.error) throw up.error;
      await logAudit("yard_move", "vehicles", moving.id, { from: moving.yard_zone, to: toZone });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["yard-board"] });
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      setMoving(null);
      setToZone("");
      setReason("");
      toast.success("Vehicle moved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const zones = data?.zones ?? [];
  const vehicles = data?.vehicles ?? [];

  return (
    <>
      <PageHeader title="Yard Zones" subtitle="Live board of where every vehicle is standing" />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {zones.map((z) => {
          const list = vehicles.filter((v) => v.yard_zone === z.name);
          return (
            <Card key={z.id} className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-semibold">{z.name}</h2>
                <span className="text-xs text-muted-foreground">
                  {list.length}
                  {z.capacity ? ` / ${z.capacity}` : ""}
                </span>
              </div>
              {list.length === 0 ? (
                <p className="text-sm text-muted-foreground">Empty</p>
              ) : (
                <ul className="space-y-2">
                  {list.map((v) => (
                    <li key={v.id} className="rounded-md border p-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{v.registration_number}</span>
                        <StatusBadge value={v.status} />
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 w-full"
                        onClick={() => {
                          setMoving(v);
                          setToZone("");
                        }}
                      >
                        Move zone
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>

      <Card className="mt-5 p-4">
        <h2 className="mb-3 font-semibold">Recent movements</h2>
        <ul className="divide-y text-sm">
          {(data?.moves ?? []).map((m) => {
            const v = vehicles.find((x) => x.id === m.vehicle_id);
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="font-medium">{v?.registration_number ?? "—"}</span>
                <span className="text-muted-foreground">
                  {m.from_zone ?? "Outside"} → {m.to_zone}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">{formatValue(m.moved_at)}</span>
              </li>
            );
          })}
        </ul>
      </Card>

      <Dialog open={!!moving} onOpenChange={(o) => !o && setMoving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move {moving?.registration_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">Move to zone</Label>
              <select
                value={toZone}
                onChange={(e) => setToZone(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">—</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.name}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">Reason</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => move.mutate()} disabled={move.isPending}>
              Save movement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
