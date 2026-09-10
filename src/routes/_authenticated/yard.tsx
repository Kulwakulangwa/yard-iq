import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/orbis/AppShell";
import { StatusBadge } from "@/components/orbis/StatusBadge";
import { Stat } from "./dashboard";

export const Route = createFileRoute("/_authenticated/yard")({
  head: () => ({ meta: [{ title: "Yard Dashboard — Orbis Logistics" }] }),
  component: YardDashboard,
});

const db = supabase as never as { from: (t: string) => any };

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
  const inYard = d?.vehicles.filter((v) => ["In Yard", "Loading", "On Hold", "In Maintenance"].includes(v.status)) ?? [];
  const gateToday = d?.gates.filter((g) => String(g.event_time ?? "").slice(0, 10) === today) ?? [];

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
            <Stat label="Waiting to load" value={d?.vehicles.filter((v) => v.yard_zone === "Loading Bay").length ?? 0} />
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
            <Stat label="Vehicles on hold" value={d?.vehicles.filter((v) => v.status === "On Hold").length ?? 0} tone="red" />
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
                const list = inYard.filter((v) => v.yard_zone === z.name);
                return (
                  <div key={z.id} className="rounded-md border p-3">
                    <p className="text-sm font-medium">{z.name}</p>
                    <p className="text-xs text-muted-foreground">{list.length} vehicle(s)</p>
                    <ul className="mt-2 space-y-1">
                      {list.map((v) => (
                        <li key={v.id} className="flex items-center justify-between text-sm">
                          <span>{v.registration_number}</span>
                          <StatusBadge value={v.status} />
                        </li>
                      ))}
                    </ul>
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
