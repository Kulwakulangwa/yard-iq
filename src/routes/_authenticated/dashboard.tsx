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
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

const db = supabase as never as { from: (t: string) => any };

function useOffice() {
  return useQuery({
    queryKey: ["office-dashboard"],
    queryFn: async () => {
      const [trips, fin, loads, vehicles, invoices, expenses, opex, payments, fuel, exceptions, customers, drivers] =
        await Promise.all([
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
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3">Trip</th>
                    <th className="py-2 pr-3">Customer</th>
                    <th className="py-2 pr-3">Route</th>
                    <th className="py-2 pr-3">Driver</th>
                    <th className="py-2 pr-3">Contract value</th>
                    <th className="py-2 pr-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrips.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-muted-foreground">
                        No trips in this view.
                      </td>
                    </tr>
                  ) : (
                    filteredTrips.slice(0, 25).map((t) => {
                      const f = finByTrip.get(t.id);
                      return (
                        <tr key={t.id} className="border-b last:border-0">
                          <td className="py-2 pr-3 font-medium">{t.trip_number}</td>
                          <td className="py-2 pr-3">{nameOf(d?.customers, t.customer_id, "name")}</td>
                          <td className="py-2 pr-3 text-muted-foreground">
                            {t.origin} → {t.destination}
                          </td>
                          <td className="py-2 pr-3">{nameOf(d?.drivers, t.driver_id, "full_name")}</td>
                          <td className="py-2 pr-3">
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
                          <td className="py-2 pr-3">
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
