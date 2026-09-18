import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/orbis/AppShell";
import { StatusBadge } from "@/components/orbis/StatusBadge";
import { tzs, usd, sum } from "@/lib/money";
import { useFxRate } from "@/lib/fx";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Office Dashboard — Orbis Logistics" },
      { name: "description", content: "Revenue, cash disbursed, fuel and live trip status for the Orbis border fleet." },
      { property: "og:title", content: "Office Dashboard — Orbis Logistics" },
      { property: "og:description", content: "Revenue, cash disbursed, fuel and live trip status for the Orbis border fleet." },
      { property: "og:type", content: "website" },
      { property: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

const db = supabase as never as { from: (t: string) => any };

function useOffice() {
  return useQuery({
    queryKey: ["office-dashboard"],
    queryFn: async () => {
      const [
        trips,
        fin,
        loads,
        vehicles,
        invoices,
        expenses,
        opex,
        payments,
        fuel,
        exceptions,
        customers,
        drivers,
        tripVehicles,
      ] = await Promise.all([
        db.from("trips").select("*"),
        db.from("trip_financials").select("*"),
        db.from("loads").select("*"),
        db.from("vehicles").select("*"),
        db.from("invoices").select("*"),
        db.from("expenses").select("*"),
        db.from("operational_expenses").select("*"),
        db.from("driver_payments").select("*"),
        db.from("fuel_allocations").select("*"),
        db.from("exceptions").select("*"),
        db.from("customers").select("id,name"),
        db.from("drivers").select("id,full_name"),
        db.from("trip_vehicles").select("*"),
      ]);
      const arr = (r: any) => (r?.data ?? []) as any[];
      return {
        trips: arr(trips),
        fin: arr(fin),
        loads: arr(loads),
        vehicles: arr(vehicles),
        invoices: arr(invoices),
        expenses: arr(expenses),
        opex: arr(opex),
        payments: arr(payments),
        fuel: arr(fuel),
        exceptions: arr(exceptions),
        customers: arr(customers),
        drivers: arr(drivers),
        tripVehicles: arr(tripVehicles),
      };
    },
  });
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "amber" | "red";
}) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={
          "mt-1 text-xl font-semibold sm:text-2xl " +
          (tone === "red" ? "text-destructive" : tone === "amber" ? "text-warning-foreground" : "text-foreground")
        }
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}

function timeAgo(value: unknown) {
  if (!value) return "time not recorded";
  const then = new Date(String(value)).getTime();
  if (!Number.isFinite(then)) return "time not recorded";
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

const IN_TRANSIT = ["Dispatched", "In Transit", "In Yard", "At Border"];
const DONE = ["Completed", "Delivered", "Closed"];

function Dashboard() {
  const { data, isLoading } = useOffice();
  const [tab, setTab] = useState("all");
  const d = data;
  const fx = useFxRate();
  const today = new Date().toISOString().slice(0, 10);

  const finByTrip = useMemo(() => {
    const m = new Map<string, any>();
    (d?.fin ?? []).forEach((f) => m.set(f.trip_id, f));
    return m;
  }, [d]);

  const trucksByTrip = useMemo(() => {
    const m = new Map<string, { vehicle: string; driver: string; role: string }[]>();
    const vehicleReg = new Map<string, string>(
      (d?.vehicles ?? []).map((v) => [String(v.id), String(v.registration_number ?? "")]),
    );
    const driverName = new Map<string, string>(
      (d?.drivers ?? []).map((dr) => [String(dr.id), String(dr.full_name ?? "")]),
    );
    for (const tv of d?.tripVehicles ?? []) {
      const tripId = String(tv.trip_id);
      const list = m.get(tripId) ?? [];
      list.push({
        vehicle: vehicleReg.get(String(tv.vehicle_id)) ?? "—",
        driver: driverName.get(String(tv.driver_id)) ?? "—",
        role: String(tv.role ?? "Lead"),
      });
      m.set(tripId, list);
    }
    return m;
  }, [d]);

  const nameOf = (list: any[] | undefined, id: string, key: string) =>
    list?.find((r) => r.id === id)?.[key] ?? "—";

  const revenueTzs = sum(d?.fin ?? [], (f: any) => f.total_contract_tzs);
  const collectedTzs = sum(d?.fin ?? [], (f: any) => f.customer_paid_tzs);
  const cashDisbursed =
    sum(d?.expenses ?? [], (e: any) => e.amount) +
    sum(d?.opex ?? [], (e: any) => e.amount_tzs ?? e.amount) +
    sum(d?.payments ?? [], (p: any) => p.amount_tzs) +
    sum(d?.fin ?? [], (f: any) => f.advance_paid_tzs);
  const litres = sum(d?.fuel ?? [], (f: any) => f.approved_litres);
  const fuelCost = sum(d?.fuel ?? [], (f: any) => f.fuel_cost);
  const outstanding = revenueTzs - collectedTzs;

  const activeTrips = d?.trips.filter((t) => IN_TRANSIT.includes(t.status)).length ?? 0;
  const awaitingDispatch = d?.trips.filter((t) => ["Approved", "Ready for Yard", "Planned"].includes(t.status)).length ?? 0;
  const loadsToVerify = d?.loads.filter((l) => ["Loaded", "Awaiting Loading", "Loading"].includes(l.status)).length ?? 0;
  const available = d?.vehicles.filter((v) => v.status === "Available").length ?? 0;
  const inMaint = d?.vehicles.filter((v) => v.status === "In Maintenance").length ?? 0;
  const openInvoices = d?.invoices.filter((i) => i.status !== "Paid").length ?? 0;
  const todayExpense =
    d?.expenses.filter((e) => String(e.expense_date ?? "").slice(0, 10) === today).reduce((s, e) => s + Number(e.amount ?? 0), 0) ?? 0;
  const openExceptions = d?.exceptions.filter((e) => e.status === "Open") ?? [];

  const filteredTrips = (d?.trips ?? []).filter((t) => {
    if (tab === "transit") return IN_TRANSIT.includes(t.status);
    if (tab === "settlement") return DONE.includes(t.status) && !t.settled_at;
    if (tab === "completed") return DONE.includes(t.status) && !!t.settled_at;
    return true;
  });

  return (
    <>
      <PageHeader title="Office Dashboard" subtitle="Revenue, cash and live trip status across the border fleet" />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Contract revenue" value={tzs(revenueTzs)} hint={usd(revenueTzs / fx)} />
            <Stat label="Cash disbursed" value={tzs(cashDisbursed)} hint={usd(cashDisbursed / fx)} />
            <Stat label="Outstanding from customers" value={tzs(outstanding)} tone={outstanding > 0 ? "amber" : "default"} />
            <Stat label="Fuel approved" value={`${litres.toLocaleString()} L`} hint={tzs(fuelCost)} />
            <Stat label="Active trips" value={activeTrips} />
            <Stat label="Awaiting dispatch" value={awaitingDispatch} tone="amber" />
            <Stat label="Loads to verify" value={loadsToVerify} tone="amber" />
            <Stat label="Vehicles available" value={available} />
            <Stat label="In maintenance" value={inMaint} tone="amber" />
            <Stat label="Open invoices" value={openInvoices} />
            <Stat label="Today's expenses" value={tzs(todayExpense)} />
            <Stat label="Exceptions to approve" value={openExceptions.length} tone="red" />
          </div>

          <Card className="mt-5 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">Trips</h2>
              <Link to="/m/$slug" params={{ slug: "trips" }} className="text-sm text-primary hover:underline">
                Manage trips
              </Link>
            </div>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="flex-wrap">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="transit">In transit</TabsTrigger>
                <TabsTrigger value="settlement">Pending settlement</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3">Trip</th>
                    <th className="py-2 pr-3">Customer</th>
                    <th className="py-2 pr-3">Route</th>
                    <th className="py-2 pr-3">Trucks / Drivers</th>
                    <th className="py-2 pr-3">Contract value</th>
                    <th className="py-2 pr-3">Current location</th>
                    <th className="py-2 pr-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrips.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-muted-foreground">
                        No trips in this view.
                      </td>
                    </tr>
                  ) : (
                    filteredTrips.slice(0, 25).map((t) => {
                      const f = finByTrip.get(t.id);
                      const trucks = trucksByTrip.get(String(t.id)) ?? [];
                      return (
                        <tr key={t.id} className="border-b last:border-0 align-top">
                          <td className="py-3 pr-3 font-medium">{t.trip_number}</td>
                          <td className="py-3 pr-3">{nameOf(d?.customers, t.customer_id, "name")}</td>
                          <td className="py-3 pr-3 text-muted-foreground">
                            {t.origin} → {t.destination}
                          </td>
                          <td className="py-3 pr-3">
                            {trucks.length === 0 ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <div className="space-y-1.5">
                                {trucks.map((tr, i) => (
                                  <div key={i} className="leading-tight">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-medium">{tr.vehicle}</span>
                                      <span className="rounded-full border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                                        {tr.role}
                                      </span>
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {tr.driver}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="py-3 pr-3">
                            {f ? (
                              <span>
                                {tzs(f.total_contract_tzs)}
                                <span className="block text-xs text-muted-foreground">
                                  {usd(f.contract_currency === "USD" ? f.contract_amount : Number(f.total_contract_tzs ?? 0) / fx)}
                                </span>
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-3 pr-3">
                            {t.current_location ? (
                              <span>
                                {t.current_location}
                                <span className="block text-xs text-muted-foreground">{timeAgo(t.current_location_at)}</span>
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Not reported</span>
                            )}
                          </td>
                          <td className="py-3 pr-3">
                            <StatusBadge value={t.status} />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="mt-5 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Exceptions requiring approval</h2>
              <Link to="/approvals" className="text-sm text-primary hover:underline">
                Open approvals
              </Link>
            </div>
            {openExceptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing waiting. Everything matches the plan.</p>
            ) : (
              <ul className="divide-y">
                {openExceptions.slice(0, 6).map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                    <span className="font-medium">{e.exception_number}</span>
                    <span className="text-muted-foreground">{e.exception_type}</span>
                    <StatusBadge value={e.severity} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </>
  );
}
