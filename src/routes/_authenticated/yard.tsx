import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Link2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/orbis/AppShell";
import { StatusBadge } from "@/components/orbis/StatusBadge";
import { Stat } from "@/components/orbis/Stat";
import { PairingOverview } from "@/components/orbis/PairingOverview";

export const Route = createFileRoute("/_authenticated/yard")({
  head: () => ({ meta: [{ title: "Yard Dashboard — Orbis Logistics" }] }),
  component: YardDashboard,
});

const db = supabase as never as { from: (t: string) => any };

// Anything except "On Trip" is physically in the yard.
const YARD_STATUSES = ["Available", "In Yard", "Loading", "In Maintenance", "On Hold"];

function isInYard(v: any) {
  return YARD_STATUSES.includes(String(v.status));
}

function YardDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["yard-dashboard"],
    queryFn: async () => {
      const [vehicles, gates, loads, inspections, incidents, tires, zones] = await Promise.all([
        db.from("vehicles").select("*"),
        db.from("gate_entries").select("*"),
        db.from("loads").select("*"),
        db.from("vehicle_inspections").select("*"),
        db.from("incidents").select("*"),
        db.from("tires").select("*"),
        db.from("yard_zones").select("*"),
      ]);
      return {
        vehicles: (vehicles.data ?? []) as any[],
        gates: (gates.data ?? []) as any[],
        loads: (loads.data ?? []) as any[],
        inspections: (inspections.data ?? []) as any[],
        incidents: (incidents.data ?? []) as any[],
        tires: (tires.data ?? []) as any[],
        zones: (zones.data ?? []) as any[],
      };
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const d = data;
  const inYard = (d?.vehicles ?? []).filter(isInYard);
  const gateToday = d?.gates.filter((g) => String(g.event_time ?? "").slice(0, 10) === today) ?? [];

  const byId = new Map((d?.vehicles ?? []).map((v) => [String(v.id), v]));
  const partnerLabel = (v: any) => {
    if (!v?.coupled_to_id) return null;
    const partner = byId.get(String(v.coupled_to_id));
    return partner?.registration_number ?? null;
  };

  return (
    <>
      <PageHeader title="Yard Dashboard" subtitle="What is physically happening in the yard right now" />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Vehicles in yard" value={inYard.length} />
            <Stat label="Gate ins today" value={gateToday.filter((g) => g.direction === "In").length} />
            <Stat label="Gate outs today" value={gateToday.filter((g) => g.direction === "Out").length} />
            <Stat
              label="Waiting to load"
              value={inYard.filter((v) => v.yard_zone === "Loading Bay").length}
            />
            <Stat
              label="Loads awaiting verification"
              value={d?.loads.filter((l) => l.status === "Loaded").length ?? 0}
              tone="amber"
            />
            <Stat
              label="Inspection failures"
              value={d?.inspections.filter((i) => i.result === "Fail").length ?? 0}
              tone="red"
            />
            <Stat
              label="Open incidents"
              value={d?.incidents.filter((i) => ["Open", "Under Investigation", "Escalated"].includes(i.status)).length ?? 0}
              tone="red"
            />
            <Stat
              label="Tire discrepancies"
              value={d?.tires.filter((t) => ["Missing", "Disputed"].includes(t.status)).length ?? 0}
              tone="red"
            />
            <Stat
              label="Vehicles on hold"
              value={inYard.filter((v) => v.status === "On Hold").length}
              tone="red"
            />
          </div>

          <div className="mt-5">
            <PairingOverview vehicles={d?.vehicles ?? []} />
          </div>

          <Card className="mt-5 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Vehicles by zone</h2>
              <Link to="/zones" className="text-sm text-primary hover:underline">
                Yard board
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(d?.zones ?? []).map((z) => {
                const trucksHere = inYard.filter((v) => v.yard_zone === z.name && !v.is_trailer);
                const trailersHere = inYard.filter((v) => v.yard_zone === z.name && v.is_trailer);
                const total = trucksHere.length + trailersHere.length;
                return (
                  <div key={z.id} className="rounded-md border p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-medium">{z.name}</p>
                      <span className="text-xs text-muted-foreground">
                        {total}
                        {z.capacity ? ` / ${z.capacity}` : ""}
                      </span>
                    </div>

                    {trucksHere.length > 0 ? (
                      <div className="mb-2">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Trucks
                        </p>
                        <ul className="space-y-1">
                          {trucksHere.map((v) => {
                            const partner = partnerLabel(v);
                            return (
                              <li key={v.id} className="flex items-center justify-between gap-2 text-sm">
                                <div className="flex min-w-0 items-center gap-1.5">
                                  <span className="font-medium">{v.registration_number}</span>
                                  {partner ? (
                                    <span className="inline-flex items-center gap-0.5 text-xs text-primary">
                                      <Link2 className="size-3" />
                                      {partner}
                                    </span>
                                  ) : null}
                                </div>
                                <StatusBadge value={v.status} />
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
                        <ul className="space-y-1">
                          {trailersHere.map((v) => {
                            const partner = partnerLabel(v);
                            return (
                              <li key={v.id} className="flex items-center justify-between gap-2 text-sm">
                                <div className="flex min-w-0 items-center gap-1.5">
                                  <span className="font-medium">{v.registration_number}</span>
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
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : null}

                    {total === 0 ? (
                      <p className="text-sm text-muted-foreground">Empty</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}
    </>
  );
}
