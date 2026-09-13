import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";

import { selectAll } from "@/lib/db";
import { tzs } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/orbis/AppShell";
import { StatusBadge } from "@/components/orbis/StatusBadge";

export const Route = createFileRoute("/_authenticated/voucher")({
  head: () => ({
    meta: [
      { title: "Driver Voucher — Orbis Logistics" },
      { name: "description", content: "Printable trip vouchers showing driver, vehicle, route and allowances." },
      { property: "og:title", content: "Driver Voucher — Orbis Logistics" },
      { property: "og:description", content: "Printable trip vouchers showing driver, vehicle, route and allowances." },
    ],
  }),
  component: VoucherPage,
});

function VoucherPage() {
  const { data: vouchers = [], isLoading } = useQuery({
    queryKey: ["driver-vouchers"],
    queryFn: async () => {
      const [trips, drivers, vehicles, financials] = await Promise.all([
        selectAll("trips"),
        selectAll("drivers"),
        selectAll("vehicles"),
        selectAll("trip_financials"),
      ]);
      const driverName = new Map(drivers.map((d: any) => [String(d.id), d.full_name]));
      const reg = new Map(vehicles.map((v: any) => [String(v.id), v.registration_number]));
      const finByTrip = new Map(financials.map((f: any) => [String(f.trip_id), f]));
      return trips
        .filter((t: any) => ["Approved", "Ready for Yard", "In Yard", "Dispatched", "In-Transit"].includes(String(t.status)))
        .map((t: any) => ({
          id: t.id,
          number: t.trip_number,
          status: t.status,
          driver: driverName.get(String(t.driver_id)) ?? "—",
          vehicle: reg.get(String(t.vehicle_id)) ?? "—",
          route: `${t.origin ?? "—"} → ${t.destination ?? "—"}`,
          departure: String(t.planned_departure ?? "—").slice(0, 16),
          allowance: Number(finByTrip.get(String(t.id))?.driver_allowance_tzs ?? 0),
        }));
    },
  });

  return (
    <>
      <PageHeader
        title="Driver Voucher"
        subtitle="Trip vouchers for drivers heading to the border"
        actions={
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-1.5 size-4" /> Print
          </Button>
        }
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading vouchers…</p>
      ) : vouchers.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">No active trips to issue vouchers for.</Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {vouchers.map((v: any) => (
            <Card key={String(v.id)} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Trip voucher</p>
                  <p className="text-lg font-semibold">{v.number ?? "—"}</p>
                </div>
                <StatusBadge value={v.status} />
              </div>
              <dl className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Driver</dt>
                  <dd className="font-medium">{v.driver}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Vehicle</dt>
                  <dd className="font-medium">{v.vehicle}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Route</dt>
                  <dd className="text-right font-medium">{v.route}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Departure</dt>
                  <dd className="font-medium">{v.departure}</dd>
                </div>
                <div className="flex justify-between gap-3 border-t pt-2">
                  <dt className="text-muted-foreground">Allowance</dt>
                  <dd className="font-semibold">{tzs(v.allowance)}</dd>
                </div>
              </dl>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
