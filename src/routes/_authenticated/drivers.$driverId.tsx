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

export const Route = createFileRoute("/_authenticated/drivers/$driverId")({
  head: () => ({
    meta: [
      { title: "Driver Profile — Orbis Logistics" },
      { name: "description", content: "Driver profile with trip history, salary, advances and bonuses." },
      { property: "og:title", content: "Driver Profile — Orbis Logistics" },
      { property: "og:description", content: "Driver profile with trip history, salary, advances and bonuses." },
    ],
  }),
  component: DriverProfile,
});

function DriverProfile() {
  const { driverId } = useParams({ from: "/_authenticated/drivers/$driverId" });

  const { data, isLoading } = useQuery({
    queryKey: ["driver-profile", driverId],
    queryFn: async () => {
      const [drivers, trips, payments, vehicles] = await Promise.all([
        selectAll("drivers"),
        selectAll("trips"),
        selectAll("driver_payments"),
        selectAll("vehicles"),
      ]);
      const driver = drivers.find((d: any) => String(d.id) === driverId) ?? null;
      const reg = new Map(vehicles.map((v: any) => [String(v.id), v.registration_number]));
      return {
        driver,
        trips: trips
          .filter((t: any) => String(t.driver_id) === driverId)
          .map((t: any) => ({ ...t, vehicle: reg.get(String(t.vehicle_id)) ?? "—" })),
        payments: payments.filter((p: any) => String(p.driver_id) === driverId),
      };
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading driver…</p>;
  if (!data?.driver) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <h1 className="text-lg font-semibold">Driver not found</h1>
        <Link to="/drivers" className="mt-2 inline-block text-sm text-primary hover:underline">
          Back to drivers
        </Link>
      </div>
    );
  }

  const d = data.driver;
  const salary = sum(data.payments.filter((p: any) => p.payment_type === "Salary"), (p: any) => p.amount_tzs);
  const advances = sum(data.payments.filter((p: any) => p.payment_type === "Advance"), (p: any) => p.amount_tzs);
  const bonuses = sum(data.payments.filter((p: any) => p.payment_type === "Bonus"), (p: any) => p.amount_tzs);

  return (
    <>
      <Link to="/drivers" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All drivers
      </Link>
      <PageHeader
        title={String(d.full_name ?? "Driver")}
        subtitle={`${d.driver_code ?? "—"} · ${d.phone ?? "no phone"} · licence ${String(d.licence_number ?? "—")}`}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Trips" value={data.trips.length} />
        <Stat label="Salary paid" value={tzs(salary)} tone="green" />
        <Stat label="Advances" value={tzs(advances)} tone="amber" />
        <Stat label="Bonuses" value={tzs(bonuses)} />
      </div>

      <Card className="mt-5 p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Trip history</h2>
          <StatusBadge value={d.status} />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trip</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Departure</TableHead>
                <TableHead>KM</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.trips.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>No trips recorded.</TableCell>
                </TableRow>
              ) : (
                data.trips.map((t: any) => (
                  <TableRow key={String(t.id)}>
                    <TableCell className="whitespace-nowrap font-medium">{t.trip_number ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {t.origin ?? "—"} → {t.destination ?? "—"}
                    </TableCell>
                    <TableCell>{t.vehicle}</TableCell>
                    <TableCell className="whitespace-nowrap">{String(t.planned_departure ?? "—").slice(0, 16)}</TableCell>
                    <TableCell>{Number(t.planned_distance ?? 0).toLocaleString()}</TableCell>
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
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Payment history</h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>No payments recorded.</TableCell>
                </TableRow>
              ) : (
                data.payments.map((p: any) => (
                  <TableRow key={String(p.id)}>
                    <TableCell className="whitespace-nowrap">{String(p.payment_date ?? "—").slice(0, 10)}</TableCell>
                    <TableCell>
                      <StatusBadge value={p.payment_type} />
                    </TableCell>
                    <TableCell>{p.period_label ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{tzs(p.amount_tzs)}</TableCell>
                    <TableCell>{p.notes ?? "—"}</TableCell>
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
