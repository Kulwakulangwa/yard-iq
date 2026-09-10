import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { exportCsv, formatValue } from "@/lib/orbis";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/orbis/AppShell";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — Orbis Logistics" }] }),
  component: Reports,
});

const db = supabase as never as { from: (t: string) => any };

const tabs = [
  { key: "gate", label: "Daily Gate Report", table: "gate_entries", columns: ["entry_type", "vehicle_id", "driver_id", "trip_id", "odometer", "gate_decision", "created_at"] },
  { key: "fuel", label: "Fuel Issue Report", table: "fuel_allocations", columns: ["reference", "trip_id", "vehicle_id", "fuel_type", "approved_litres", "fuel_cost", "supplier", "status"] },
  { key: "trips", label: "Active Trips", table: "trips", columns: ["trip_number", "customer_id", "origin", "destination", "vehicle_id", "driver_id", "status", "planned_departure"] },
  { key: "tires", label: "Tire Movement Report", table: "tire_movements", columns: ["tire_id", "movement_type", "vehicle_id", "wheel_position", "technician", "verifier", "moved_at"] },
  { key: "incidents", label: "Incident Report", table: "incidents", columns: ["incident_number", "incident_type", "severity", "vehicle_id", "status", "occurred_at"] },
];

function Reports() {
  const [tab, setTab] = useState("gate");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const active = tabs.find((t) => t.key === tab) ?? tabs[0];

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["report", active.table, from, to],
    queryFn: async () => {
      let q = db.from(active.table).select("*").order("created_at", { ascending: false });
      if (from) q = q.gte("created_at", `${from}T00:00:00`);
      if (to) q = q.lte("created_at", `${to}T23:59:59`);
      const { data, error } = await q.limit(500);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const filename = useMemo(() => `orbis-${active.key}-${new Date().toISOString().slice(0, 10)}`, [active.key]);

  return (
    <>
      <PageHeader title="Reports" subtitle="Exportable operational reports for office and yard" />

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Button key={t.key} size="sm" variant={tab === t.key ? "default" : "outline"} onClick={() => setTab(t.key)}>
            {t.label}
          </Button>
        ))}
      </div>

      <Card className="mb-4 p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">From</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">To</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button variant="outline" onClick={() => exportCsv(filename, rows, active.columns)}>
            <Download className="mr-1.5 size-4" /> Export CSV
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                {active.columns.map((c) => (
                  <th key={c} className="whitespace-nowrap px-3 py-2 text-left font-medium">
                    {c.replace(/_/g, " ").replace(/\b\w/g, (x) => x.toUpperCase())}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={active.columns.length} className="px-3 py-4 text-muted-foreground">Loading…</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={active.columns.length} className="px-3 py-4 text-muted-foreground">No records match.</td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    {active.columns.map((c) => (
                      <td key={c} className="whitespace-nowrap px-3 py-2">
                        {formatValue(r[c])}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
