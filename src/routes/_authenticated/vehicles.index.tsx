import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { selectAll } from "@/lib/db";
import { sum, tzs } from "@/lib/money";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/orbis/AppShell";
import { StatusBadge } from "@/components/orbis/StatusBadge";
import { Stat } from "@/components/orbis/Stat";

export const Route = createFileRoute("/_authenticated/vehicles/")({
  head: () => ({
    meta: [
      { title: "Fleet Vehicles — Orbis Logistics" },
      { name: "description", content: "Fleet inventory with trips, kilometres and revenue booked per vehicle." },
      { property: "og:title", content: "Fleet Vehicles — Orbis Logistics" },
      { property: "og:description", content: "Fleet inventory with trips, kilometres and revenue booked per vehicle." },
    ],
  }),
  component: VehiclesPage,
});

function useFleet() {
  return useQuery({
    queryKey: ["fleet-overview"],
    queryFn: async () => {
      const [vehicles, trips, financials] = await Promise.all([
        selectAll("vehicles"),
        selectAll("trips"),
        selectAll("trip_financials"),
      ]);
      const finByTrip = new Map(financials.map((f) => [f.trip_id, f]));
      return vehicles.map((v) => {
        const own = trips.filter((t) => t.vehicle_id === v.id);
        const active = own.filter((t) => ["Dispatched", "In-Transit", "In Yard"].includes(String(t.status)));
        return {
          ...v,
          tripCount: own.length,
          activeCount: active.length,
          km: sum(own, (t) => t.planned_distance),
          revenue: sum(own, (t) => finByTrip.get(t.id)?.total_contract_tzs),
        };
      });
    },
  });
}

function VehiclesPage() {
  const { data: rows = [], isLoading } = useFleet();
  const [term, setTerm] = useState("");
  const filtered = rows.filter((r) =>
    `${r.registration_number ?? ""} ${r.vehicle_type ?? ""}`.toLowerCase().includes(term.trim().toLowerCase()),
  );

  return (
    <>
      <PageHeader title="Vehicles" subtitle="Fleet inventory, utilisation and revenue booked" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Total vehicles" value={rows.length} />
        <Stat label="Currently on trips" value={rows.filter((r) => r.activeCount > 0).length} />
        <Stat label="Revenue booked" value={tzs(sum(rows, (r) => r.revenue))} />
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
                <TableHead>Active / total trips</TableHead>
                <TableHead>Total KM</TableHead>
                <TableHead>Revenue booked</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7}>Loading…</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>No vehicles yet.</TableCell>
                </TableRow>
              ) : (
                filtered.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="whitespace-nowrap font-medium">
                      <Link
                        to="/vehicles/$vehicleId"
                        params={{ vehicleId: String(v.id) }}
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
                    <TableCell>
                      {v.activeCount} / {v.tripCount}
                    </TableCell>
                    <TableCell>{v.km.toLocaleString()}</TableCell>
                    <TableCell className="whitespace-nowrap">{tzs(v.revenue)}</TableCell>
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
