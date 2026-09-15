import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { selectAll } from "@/lib/db";
import { dual, sum, tzs, vatBreakdown } from "@/lib/money";
import { useFxRate } from "@/lib/fx";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/orbis/AppShell";
import { Stat } from "@/components/orbis/Stat";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({
    meta: [
      { title: "Finance Summary — Orbis Logistics" },
      { name: "description", content: "Revenue, trip costs, driver and workshop payments with VAT position in TZS." },
      { property: "og:title", content: "Finance Summary — Orbis Logistics" },
      { property: "og:description", content: "Revenue, trip costs, driver and workshop payments with VAT position in TZS." },
    ],
  }),
  component: FinancePage,
});

function FinancePage() {
  const fx = useFxRate();
  const { data, isLoading } = useQuery({
    queryKey: ["finance-summary"],
    queryFn: async () => {
      const [financials, expenses, opex, driverPayments, maintenance] = await Promise.all([
        selectAll("trip_financials"),
        selectAll("expenses"),
        selectAll("operational_expenses"),
        selectAll("driver_payments"),
        selectAll("vehicle_maintenance"),
      ]);
      const revenue = sum(financials, (f: any) => f.total_contract_tzs);
      const tripCosts = sum(expenses, (e: any) => e.amount);
      const operational = sum(opex, (o: any) => o.amount_tzs);
      const driverCost = sum(driverPayments, (p: any) => p.amount_tzs);
      const workshop = sum(maintenance, (m: any) => m.cost_tzs);
      const costs = tripCosts + operational + driverCost + workshop;
      return { revenue, tripCosts, operational, driverCost, workshop, costs, profit: revenue - costs };
    },
  });

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading finance summary…</p>;

  const revenueDual = dual(data.revenue, fx);
  const vat = vatBreakdown(data.revenue);

  return (
    <>
      <PageHeader title="Finance" subtitle="Revenue, costs and VAT position across the fleet" />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Revenue booked" value={revenueDual.primary} sub={revenueDual.secondary} tone="green" />
        <Stat label="Total costs" value={tzs(data.costs)} tone="amber" />
        <Stat label="Gross profit" value={tzs(data.profit)} tone={data.profit >= 0 ? "green" : "red"} />
        <Stat label="VAT at 18%" value={tzs(vat.vat)} sub={`Invoiced total ${tzs(vat.total)}`} />
      </div>

      <Card className="mt-5 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Cost breakdown</h2>
        <ul className="divide-y text-sm">
          {[
            ["Trip expenses", data.tripCosts],
            ["Operational expenses", data.operational],
            ["Driver payments", data.driverCost],
            ["Workshop / maintenance", data.workshop],
          ].map(([label, value]) => (
            <li key={String(label)} className="flex items-center justify-between py-2">
              <span>{label}</span>
              <span className="font-medium">{tzs(Number(value))}</span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
