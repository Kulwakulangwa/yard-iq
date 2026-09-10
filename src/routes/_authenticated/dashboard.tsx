import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/orbis/AppShell";
import { StatusBadge } from "@/components/orbis/StatusBadge";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Office Dashboard — Orbis Logistics" }] }),
  component: Dashboard,
});

const db = supabase as never as { from: (t: string) => any };

function useOffice() {
  return useQuery({
    queryKey: ["office-dashboard"],
    queryFn: async () => {
      const [trips, loads, vehicles, invoices, expenses, fuel, exceptions] = await Promise.all([
        db.from("trips").select("*"),
        db.from("loads").select("*"),
        db.from("vehicles").select("*"),
        db.from("invoices").select("*"),
        db.from("expenses").select("*"),
        db.from("fuel_allocations").select("*"),
        db.from("exceptions").select("*"),
      ]);
      return {
        trips: (trips.data ?? []) as any[],
        loads: (loads.data ?? []) as any[],
        vehicles: (vehicles.data ?? []) as any[],
        invoices: (invoices.data ?? []) as any[],
        expenses: (expenses.data ?? []) as any[],
        fuel: (fuel.data ?? []) as any[],
        exceptions: (exceptions.data ?? []) as any[],
      };
    },
  });
}

export function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "amber" | "red";
}) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={
          "mt-1 text-2xl font-semibold " +
          (tone === "red" ? "text-destructive" : tone === "amber" ? "text-warning-foreground" : "text-foreground")
        }
      >
        {value}
      </p>
    </Card>
  );
}

function Dashboard() {
  const { data, isLoading } = useOffice();
  const d = data;
  const today = new Date().toISOString().slice(0, 10);

  const activeTrips = d?.trips.filter((t) => ["Dispatched", "In Yard"].includes(t.status)).length ?? 0;
  const awaitingDispatch = d?.trips.filter((t) => ["Approved", "Ready for Yard"].includes(t.status)).length ?? 0;
  const loadsToVerify = d?.loads.filter((l) => ["Loaded", "Awaiting Loading", "Loading"].includes(l.status)).length ?? 0;
  const available = d?.vehicles.filter((v) => v.status === "Available").length ?? 0;
  const inMaint = d?.vehicles.filter((v) => v.status === "In Maintenance").length ?? 0;
  const onTrip = d?.vehicles.filter((v) => v.status === "On Trip").length ?? 0;
  const openInvoices = d?.invoices.filter((i) => i.status !== "Paid").length ?? 0;
  const todayExpense =
    d?.expenses.filter((e) => String(e.expense_date ?? "").slice(0, 10) === today).reduce((s, e) => s + Number(e.amount ?? 0), 0) ?? 0;
  const litres = d?.fuel.reduce((s, f) => s + Number(f.approved_litres ?? 0), 0) ?? 0;
  const openExceptions = d?.exceptions.filter((e) => e.status === "Open") ?? [];

  return (
    <>
      <PageHeader title="Office Dashboard" subtitle="Planning, fleet and finance at a glance" />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Active trips" value={activeTrips} />
            <Stat label="Awaiting dispatch" value={awaitingDispatch} tone="amber" />
            <Stat label="Loads to verify" value={loadsToVerify} tone="amber" />
            <Stat label="Fuel approved (litres)" value={litres} />
            <Stat label="Vehicles available" value={available} />
            <Stat label="On trip" value={onTrip} />
            <Stat label="In maintenance" value={inMaint} tone="amber" />
            <Stat label="Open invoices" value={openInvoices} />
            <Stat label="Today's expenses" value={todayExpense.toLocaleString()} />
            <Stat label="Exceptions to approve" value={openExceptions.length} tone="red" />
          </div>

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
