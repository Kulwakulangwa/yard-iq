import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Unlink } from "lucide-react";
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

  const [coupling, setCoupling] = useState<any | null>(null);
  const [coupleTrailer, setCoupleTrailer] = useState("");

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
      qc.invalidateQueries({ queryKey: ["yard-dashboard"] });
      setMoving(null);
      setToZone("");
      setReason("");
      toast.success("Vehicle moved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const couple = useMutation({
    mutationFn: async () => {
      if (!coupling || !coupleTrailer) throw new Error("Choose a trailer");
      const { error } = await supabase.rpc("couple_vehicles", {
        truck_id: coupling.id,
        trailer_id: coupleTrailer,
      });
      if (error) throw error;
      await logAudit("couple", "vehicles", coupling.id, { trailer_id: coupleTrailer });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["yard-board"] });
      qc.invalidateQueries({ queryKey: ["yard-dashboard"] });
      setCoupling(null);
      setCoupleTrailer("");
      toast.success("Vehicles coupled");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uncouple = useMutation({
    mutationFn: async (vehicleId: string) => {
      const { error } = await supabase.rpc("uncouple_vehicle", { vehicle_id: vehicleId });
      if (error) throw error;
      await logAudit("uncouple", "vehicles", vehicleId, {});
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["yard-board"] });
      qc.invalidateQueries({ queryKey: ["yard-dashboard"] });
      toast.success("Uncoupled");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const zones = data?.zones ?? [];
  const vehicles = data?.vehicles ?? [];
  const byId = new Map(vehicles.map((v) => [String(v.id), v]));
  const partnerLabel = (v: any) => {
    if (!v?.coupled_to_id) return null;
    return byId.get(String(v.coupled_to_id))?.registration_number ?? null;
  };

  // Trailers that are free (uncoupled) and in a yard status — eligible for coupling
  const freeTrailers = vehicles.filter(
    (v) => v.is_trailer && !v.coupled_to_id && v.status !== "On Trip",
  );

  return (
    <>
      <PageHeader title="Yard Zones" subtitle="Live board of where every vehicle is standing" />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {zones.map((z) => {
          const here = vehicles.filter((v) => v.yard_zone === z.name);
          const trucksHere = here.filter((v) => !v.is_trailer);
          const trailersHere = here.filter((v) => v.is_trailer);

          return (
            <Card key={z.id} className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-semibold">{z.name}</h2>
                <span className="text-xs text-muted-foreground">
                  {here.length}
                  {z.capacity ? ` / ${z.capacity}` : ""}
                </span>
              </div>

              {here.length === 0 ? (
                <p className="text-sm text-muted-foreground">Empty</p>
              ) : (
                <div className="space-y-3">
                  {trucksHere.length > 0 ? (
                    <div>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Trucks
                      </p>
                      <ul className="space-y-2">
                        {trucksHere.map((v) => {
                          const partner = partnerLabel(v);
                          const isCoupled = Boolean(v.coupled_to_id);
                          return (
                            <li key={v.id} className="rounded-md border p-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-1.5">
                                  <span className="text-sm font-medium">{v.registration_number}</span>
                                  {partner ? (
                                    <span className="inline-flex items-center gap-0.5 text-xs text-primary">
                                      <Link2 className="size-3" />
                                      {partner}
                                    </span>
                                  ) : null}
                                </div>
                                <StatusBadge value={v.status} />
                              </div>
                              <div className="mt-2 flex gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1"
                                  onClick={() => {
                                    setMoving(v);
                                    setToZone("");
                                  }}
                                >
                                  Move zone
                                </Button>
                                {isCoupled ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => uncouple.mutate(String(v.id))}
                                    disabled={uncouple.isPending}
                                  >
                                    <Unlink className="size-4" /> Uncouple
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setCoupling(v);
                                      setCoupleTrailer("");
                                    }}
                                  >
                                    <Link2 className="size-4" /> Couple
                                  </Button>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}

                  {trailersHere.length > 0 ? (
                    <div>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Trailers
                      </p>
                      <ul className="space-y-2">
                        {trailersHere.map((v) => {
                          const partner = partnerLabel(v);
                          return (
                            <li key={v.id} className="rounded-md border p-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-1.5">
                                  <span className="text-sm font-medium">{v.registration_number}</span>
                                  {partner ? (
                                    <span className="inline-flex items-center gap-0.5 text-xs text-primary">
                                      <Link2 className="size-3" />
                                      {partner}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">free</span>
                                  )}
                                </div>
                                <StatusBadge value={v.status} />
                              </div>
                              <div className="mt-2 flex gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1"
                                  onClick={() => {
                                    setMoving(v);
                                    setToZone("");
                                  }}
                                >
                                  Move zone
                                </Button>
                                {partner ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => uncouple.mutate(String(v.id))}
                                    disabled={uncouple.isPending}
                                  >
                                    <Unlink className="size-4" /> Uncouple
                                  </Button>
                                ) : null}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}
                </div>
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

      {/* ── Move zone dialog ── */}
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

      {/* ── Couple dialog ── */}
      <Dialog open={!!coupling} onOpenChange={(o) => !o && setCoupling(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Couple {coupling?.registration_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">Trailer</Label>
              <select
                value={coupleTrailer}
                onChange={(e) => setCoupleTrailer(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">—</option>
                {freeTrailers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.registration_number}
                    {t.yard_zone ? ` · ${t.yard_zone}` : ""}
                  </option>
                ))}
              </select>
              {freeTrailers.length === 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  No free trailers available. Uncouple one first.
                </p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  Only trailers not already coupled and not on trip are shown.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => couple.mutate()} disabled={couple.isPending || !coupleTrailer}>
              Couple
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
