import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";

import { selectAll } from "@/lib/db";
import { tzs } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/orbis/AppShell";
import { StatusBadge } from "@/components/orbis/StatusBadge";

export const Route = createFileRoute("/_authenticated/voucher")({
  validateSearch: (search: Record<string, unknown>) => ({
    driver: typeof search.driver === "string" ? search.driver : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Driver Voucher — Orbis Logistics" },
      { name: "description", content: "Printable trip vouchers showing driver, vehicle, route and advance." },
      { property: "og:title", content: "Driver Voucher — Orbis Logistics" },
      { property: "og:description", content: "Printable trip vouchers showing driver, vehicle, route and advance." },
    ],
  }),
  component: VoucherPage,
});

const ACTIVE_TRIP_STATUSES = ["Approved", "Ready for Yard", "In Yard", "Dispatched", "In Transit", "At Border"];

function VoucherPage() {
  const { driver: filterDriverId } = useSearch({ from: "/_authenticated/voucher" });

  const { data, isLoading } = useQuery({
    queryKey: ["driver-vouchers", filterDriverId ?? "all"],
    queryFn: async () => {
      const [trips, drivers, vehicles, financials, tripVehicles] = await Promise.all([
        selectAll("trips"),
        selectAll("drivers"),
        selectAll("vehicles"),
        selectAll("trip_financials"),
        selectAll("trip_vehicles"),
      ]);

      const driverName = new Map(drivers.map((d: any) => [String(d.id), d.full_name]));
      const reg = new Map(vehicles.map((v: any) => [String(v.id), v.registration_number]));
      const finByTrip = new Map(financials.map((f: any) => [String(f.trip_id), f]));

      // Convoy legs per trip
      const legsByTrip = new Map<string, any[]>();
      for (const tv of tripVehicles) {
        const tid = String(tv.trip_id);
        legsByTrip.set(tid, [...(legsByTrip.get(tid) ?? []), tv]);
      }

      // Only active trips get a voucher
      const activeTrips = trips.filter((t: any) =>
        ACTIVE_TRIP_STATUSES.includes(String(t.status)),
      );

      const vouchers = activeTrips.map((t: any) => {
        const fin = finByTrip.get(String(t.id));
        const legs = legsByTrip.get(String(t.id)) ?? [];

        // All drivers involved — main driver + any convoy drivers
        const involvedDrivers = new Set<string>();
        if (t.driver_id) involvedDrivers.add(String(t.driver_id));
        for (const leg of legs) if (leg.driver_id) involvedDrivers.add(String(leg.driver_id));

        // All vehicles involved
        const involvedVehicles = new Set<string>();
        if (t.vehicle_id) involvedVehicles.add(String(t.vehicle_id));
        if (t.trailer_id) involvedVehicles.add(String(t.trailer_id));
        for (const leg of legs) {
          if (leg.vehicle_id) involvedVehicles.add(String(leg.vehicle_id));
          if (leg.trailer_id) involvedVehicles.add(String(leg.trailer_id));
        }

        return {
          id: t.id,
          number: t.trip_number,
          status: t.status,
          origin: t.origin,
          destination: t.destination,
          departure: t.planned_departure,
          arrival: t.planned_arrival,
          distance: t.planned_distance,
          advance: Number(fin?.advance_paid_tzs ?? 0),
          contract: Number(fin?.total_contract_tzs ?? 0),
          customerPaid: Number(fin?.customer_paid_tzs ?? 0),
          mainDriverName: t.driver_id ? driverName.get(String(t.driver_id)) : null,
          involvedDriverIds: [...involvedDrivers],
          convoyLegs: legs.map((leg: any) => ({
            vehicle: reg.get(String(leg.vehicle_id)) ?? "—",
            trailer: leg.trailer_id ? reg.get(String(leg.trailer_id)) ?? "—" : null,
            driver: leg.driver_id ? driverName.get(String(leg.driver_id)) : "—",
            role: leg.role,
            advance:
              Number(leg.advance_paid_tzs ?? 0) + Number(leg.advance_paid_usd ?? 0) * 2600,
            fuelLitres: Number(leg.fuel_budget_litres ?? 0),
            fuelCost: Number(leg.fuel_budget_cost ?? 0),
          })),
          mainVehicle: reg.get(String(t.vehicle_id)) ?? "—",
          mainTrailer: t.trailer_id ? reg.get(String(t.trailer_id)) ?? "—" : null,
        };
      });

      // Filter by driver if requested
      const filtered = filterDriverId
        ? vouchers.filter((v) => v.involvedDriverIds.includes(filterDriverId))
        : vouchers;

      const driver = filterDriverId
        ? drivers.find((d: any) => String(d.id) === filterDriverId) ?? null
        : null;

      return { vouchers: filtered, driver };
    },
  });

  const { vouchers = [], driver } = data ?? {};

  return (
    <>
      {filterDriverId ? (
        <Link
          to="/drivers/$driverId"
          params={{ driverId: filterDriverId }}
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground print:hidden"
        >
          <ArrowLeft className="size-4" /> Back to driver
        </Link>
      ) : null}

      <PageHeader
        title={driver ? `Voucher — ${driver.full_name ?? "Driver"}` : "Driver Vouchers"}
        subtitle={
          driver
            ? `${driver.driver_code ?? ""} · active trips only`
            : "Trip vouchers for drivers heading to the border"
        }
        actions={
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-1.5 size-4" /> Print
          </Button>
        }
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading vouchers…</p>
      ) : vouchers.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {driver
            ? `${driver.full_name} has no active trips to issue vouchers for.`
            : "No active trips to issue vouchers for."}
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 print:grid-cols-1">
          {vouchers.map((v: any) => (
            <Card key={String(v.id)} className="p-4 print:break-inside-avoid">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Trip voucher</p>
                  <p className="text-lg font-semibold">{v.number ?? "—"}</p>
                </div>
                <StatusBadge value={v.status} />
              </div>

              <dl className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Route</dt>
                  <dd className="text-right font-medium">
                    {v.origin ?? "—"} → {v.destination ?? "—"}
                  </dd>
                </div>
                {v.distance ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Distance</dt>
                    <dd className="font-medium">{Number(v.distance).toLocaleString()} km</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Departure</dt>
                  <dd className="font-medium">{String(v.departure ?? "—").slice(0, 16)}</dd>
                </div>
                {v.arrival ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Arrival</dt>
                    <dd className="font-medium">{String(v.arrival ?? "").slice(0, 16)}</dd>
                  </div>
                ) : null}
              </dl>

              {/* Trucks & Drivers */}
              <div className="mt-3 space-y-1.5 border-t pt-3 text-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Trucks &amp; drivers
                </p>
                {v.mainDriverName ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{v.mainVehicle}</dt>
                    <dd className="font-medium">{v.mainDriverName}</dd>
                  </div>
                ) : null}
                {v.convoyLegs.map((leg: any, i: number) => (
                  <div key={i} className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">
                      {leg.vehicle}
                      {leg.trailer ? ` + ${leg.trailer}` : ""}
                    </dt>
                    <dd className="font-medium">{leg.driver}</dd>
                  </div>
                ))}
              </div>

              <div className="mt-3 space-y-1.5 border-t pt-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Contract value</dt>
                  <dd className="font-medium">{tzs(v.contract)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Customer paid</dt>
                  <dd className="font-medium">{tzs(v.customerPaid)}</dd>
                </div>
                <div className="flex justify-between gap-3 border-t pt-2">
                  <dt className="font-medium">Advance paid to driver</dt>
                  <dd className="font-semibold text-warning-foreground">{tzs(v.advance)}</dd>
                </div>
              </div>

              <div className="mt-4 border-t pt-2 text-[10px] text-muted-foreground">
                Orbis Logistics · Voucher for {v.number} · Printed {new Date().toLocaleDateString("en-GB")}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
