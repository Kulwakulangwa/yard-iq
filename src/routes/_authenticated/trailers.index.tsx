import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { selectAll } from "@/lib/db";
import { sum, tzs } from "@/lib/money";
import { modules } from "@/lib/modules";
import { useRecordEditor } from "@/components/orbis/RecordEditor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/orbis/AppShell";
import { StatusBadge } from "@/components/orbis/StatusBadge";
import { Stat } from "@/components/orbis/Stat";

export const Route = createFileRoute("/_authenticated/trailers/")({
  head: () => ({
    meta: [
      { title: "Trailers — Orbis Logistics" },
      { name: "description", content: "Trailer inventory with trips towed and maintenance cost." },
      { property: "og:title", content: "Trailers — Orbis Logistics" },
      { property: "og:description", content: "Trailer inventory with trips towed and maintenance cost." },
    ],
  }),
  component: TrailersPage,
});

function useFleet() {
  return useQuery({
    queryKey: ["trailers-overview"],
    queryFn: async () => {
      const [allVehicles, trips, tripVehicles, maintenance] = await Promise.all([
        selectAll("vehicles"),
        selectAll("trips"),
        selectAll("trip_vehicles"),
        selectAll("vehicle_maintenance"),
      ]);

      const trailers = allVehicles.filter((v: any) => v.is_trailer);
      const truckReg = new Map(
        allVehicles.filter((v: any) => !v.is_trailer).map((v: any) => [String(v.id), String(v.registration_number ?? "")]),
      );
      const tripById = new Map(trips.map((t: any) => [String(t.id), t]));

      return trailers.map((v: any) => {
        // Every trip_vehicles row where this trailer was used
        const rows = tripVehicles
          .filter((tv: any) => String(tv.trailer_id) === String(v.id))
          .sort((a: any, b: any) =>
            String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")),
          );

        const tripIds = new Set(rows.map((tv: any) => String(tv.trip_id)));
        const ownTrips = trips.filter((t: any) => tripIds.has(String(t.id)));
        const active = ownTrips.filter((t: any) =>
          ["Dispatched", "In-Transit", "In Transit", "In Yard", "At Border"].includes(
            String(t.status),
          ),
        );

        // Most recent truck attached to this trailer
        const mostRecent = rows[0];
        const attachedTo = mostRecent ? truckReg.get(String(mostRecent.vehicle_id)) ?? "—" : "—";
        const attachedTrip = mostRecent ? tripById.get(String(mostRecent.trip_id)) : null;

        const maint = maintenance.filter((m: any) => String(m.vehicle_id) === String(v.id));

        return {
          ...v,
          tripCount: ownTrips.length,
          activeCount: active.length,
          km: sum(ownTrips, (t: any) => t.planned_distance),
          maintenanceCost: sum(maint, (m: any) => m.cost_tzs),
          maintenanceCount: maint.length,
          attachedTo,
          attachedTripNumber: attachedTrip?.trip_number ?? null,
        };
      });
    },
  });
}

function TrailersPage() {
  const { data: rows = [], isLoading } = useFleet();
  const editor = useRecordEditor(modules.vehicles, rows);
  const [term, setTerm] = useState("");
  const filtered = rows.filter((r) =>
    `${r.registration_number ?? ""} ${r.vehicle_type ?? ""}`.toLowerCase().includes(term.trim().toLowerCase()),
  );

  return (
    <>
      <PageHeader title="Trailers" subtitle="Trailer inventory, trips towed and maintenance cost" />
      <div className="mb-4">
        <Button onClick={() => editor.openNew({ is_trailer: true })}>New trailer</Button>
      </div>
      {editor.dialog}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Total trailers" value={rows.length} />
        <Stat label="Currently towing" value={rows.filter((r) => r.activeCount > 0).length} />
        <Stat
          label="Maintenance cost"
          value={tzs(sum(rows, (r) => r.maintenanceCost))}
          tone="amber"
        />
      </div>

      <Card className="mt-5 p-3 sm:p-4">
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search registration or type…"
          className="mb-3 sm:max-w-sm"
        />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Registration</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Attached to</TableHead>
                <TableHead>Active / total trips</TableHead>
                <TableHead>Total KM</TableHead>
                <TableHead>Maintenance</TableHead>
                <TableHead className="text-right">Edit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9}>Loading…</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9}>No trailers yet.</TableCell>
                </TableRow>
              ) : (
                filtered.map((v: any) => (
                  <TableRow key={v.id}>
                    <TableCell className="whitespace-nowrap font-medium">
                      <Link
                        to="/trailers/$trailerId"
                        params={{ trailerId: String(v.id) }}
                        className="text-primary hover:underline"
                      >
                        {v.registration_number}
                      </Link>
                    </TableCell>
                    <TableCell>{v.vehicle_type ?? "—"}</TableCell>
                    <TableCell>{v.capacity ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge value={v.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {v.attachedTo !== "—" ? (
                        <span>
                          {v.attachedTo}
                          {v.attachedTripNumber ? (
                            <span className="block text-xs text-muted-foreground">
                              {v.attachedTripNumber}
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {v.activeCount} / {v.tripCount}
                    </TableCell>
                    <TableCell>{v.km.toLocaleString()}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span>{tzs(v.maintenanceCost)}</span>
                      <span className="block text-xs text-muted-foreground">
                        {v.maintenanceCount} record{v.maintenanceCount === 1 ? "" : "s"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => editor.openEdit(v)}>
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </>
  );
}
