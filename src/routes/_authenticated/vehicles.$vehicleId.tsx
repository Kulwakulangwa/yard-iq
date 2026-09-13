import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { selectAll } from "@/lib/db";
import { sum, tzs } from "@/lib/money";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/orbis/AppShell";
import { StatusBadge } from "@/components/orbis/StatusBadge";
import { Stat } from "@/components/orbis/Stat";

export const Route = createFileRoute("/_authenticated/vehicles/$vehicleId")({
  head: () => ({
    meta: [
      { title: "Vehicle Profile — Orbis Logistics" },
      { name: "description", content: "Vehicle profile with trip history, maintenance jobs and running costs." },
      { property: "og:title", content: "Vehicle Profile — Orbis Logistics" },
      { property: "og:description", content: "Vehicle profile with trip history, maintenance jobs and running costs." },
    ],
  }),
  component: VehicleProfile,
});

function VehicleProfile() {
  const { vehicleId } = useParams({ from: "/_authenticated/vehicles/$vehicleId" });

  const { data, isLoading } = useQuery({
    queryKey: ["vehicle-profile", vehicleId],
    queryFn: async () => {
      const [vehicles, trips, financials, maintenance, drivers] = await Promise.all([
        selectAll("vehicles"),
        selectAll("trips"),
        selectAll("trip_financials"),
        selectAll("vehicle_maintenance"),
        selectAll("drivers"),
      ]);
      const vehicle = vehicles.find((v: any) => String(v.id) === vehicleId) ?? null;
      const finByTrip = new Map(financials.map((f: any) => [f.trip_id, f]));
      const driverName = new Map(drivers.map((d: any) => [String(d.id), d.full_name]));
      const own = trips
        .filter((t: any) => String(t.vehicle_id) === vehicleId)
        .map((t: any) => ({
          ...t,
          driverName: driverName.get(String(t.driver_id)) ?? "—",
          revenue: Number(finByTrip.get(t.id)?.total_contract_tzs ?? 0),
        }));
      const jobs = maintenance.filter((m: any) => String(m.vehicle_id) === vehicleId);
      return { vehicle, trips: own, jobs };
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading vehicle…</p>;
  if (!data?.vehicle) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <h1 className="text-lg font-semibold">Vehicle not found</h1>
        <Link to="/vehicles" className="mt-2 inline-block text-sm text-primary hover:underline">
          Back to vehicles
        </Link>
      </div>
    );
  }

  const v = data.vehicle;
  const km = sum(data.trips, (t: any) => t.planned_distance);
  const revenue = sum(data.trips, (t: any) => t.revenue);
  const maintCost = sum(data.jobs, (j: any) => j.cost_tzs);

  return (
    <>
      <Link to="/vehicles" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All vehicles
      </Link>
      <PageHeader title={String(v.registration_number ?? "Vehicle")} subtitle={`${v.vehicle_type ?? "Vehicle"} · ${v.capacity ?? "—"}`} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Trips" value={data.trips.length} />
        <Stat label="Total KM" value={km.toLocaleString()} />
        <Stat label="Revenue booked" value={tzs(revenue)} tone="green" />
        <Stat label="Maintenance cost" value={tzs(maintCost)} tone="amber" />
      </div>

      <Card className="mt-5 p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Trip history</h2>
          <StatusBadge value={v.status} />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trip</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Departure</TableHead>
                <TableHead>KM</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.trips.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>No trips recorded.</TableCell>
                </TableRow>
              ) : (
                data.trips.map((t: any) => (
                  <TableRow key={String(t.id)}>
                    <TableCell className="whitespace-nowrap font-medium">{t.trip_number ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {t.origin ?? "—"} → {t.destination ?? "—"}
                    </TableCell>
                    <TableCell>{t.driverName}</TableCell>
                    <TableCell className="whitespace-nowrap">{String(t.planned_departure ?? "—").slice(0, 16)}</TableCell>
                    <TableCell>{Number(t.planned_distance ?? 0).toLocaleString()}</TableCell>
                    <TableCell className="whitespace-nowrap">{tzs(t.revenue)}</TableCell>
                    <TableCell>
                      <StatusBadge value={t.status} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card className="mt-5 p-3 sm:p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Maintenance history</h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.jobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>No maintenance recorded.</TableCell>
                </TableRow>
              ) : (
                data.jobs.map((j: any) => (
                  <TableRow key={String(j.id)}>
                    <TableCell className="whitespace-nowrap">{String(j.maintenance_date ?? "—").slice(0, 10)}</TableCell>
                    <TableCell>{j.description ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{tzs(j.cost_tzs)}</TableCell>
                    <TableCell className="whitespace-nowrap">{tzs(j.paid_amount)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {tzs(Number(j.cost_tzs ?? 0) - Number(j.paid_amount ?? 0))}
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={j.status} />
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
