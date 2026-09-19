import { Stat } from "./Stat";
import { tzs, usd } from "@/lib/money";
import type { Row } from "./RecordEditor";

const VERIFIED_STATUSES = ["Approved", "Paid"];
const PENDING_STATUSES = ["Draft", "Submitted"];

export function TripSummaryCards({
  finance,
  expenses,
  trucks = [],
  fx,
}: {
  finance: Row | null;
  expenses: Row[];
  /** Trip_vehicles rows. When present, contract/advance/fuel come from here. */
  trucks?: Row[];
  fx: number;
}) {
  // ── Truck-derived totals (preferred when trucks exist) ──
  const truckContractUsd = trucks.reduce(
    (s, t) => s + Number(t["contract_amount"] ?? 0),
    0,
  );
  const truckAdvanceTzs = trucks.reduce(
    (s, t) =>
      s + Number(t["advance_paid_tzs"] ?? 0) + Number(t["advance_paid_usd"] ?? 0) * fx,
    0,
  );
  const truckFuelLitres = trucks.reduce(
    (s, t) => s + Number(t["fuel_budget_litres"] ?? 0),
    0,
  );
  const truckFuelCost = trucks.reduce(
    (s, t) => s + Number(t["fuel_budget_cost"] ?? 0),
    0,
  );

  // ── Finance fallback ──
  const financeContractTzs = Number(finance?.["total_contract_tzs"] ?? 0);
  const financeContractUsd =
    finance?.["contract_currency"] === "USD"
      ? Number(finance["contract_amount"] ?? 0)
      : financeContractTzs / fx;
  const financeAdvanceTzs =
    Number(finance?.["advance_paid_tzs"] ?? 0) +
    Number(finance?.["advance_paid_usd"] ?? 0) * fx;

  // ── Pick source ──
  const useTrucks = trucks.length > 0;
  const contractUsd = useTrucks ? truckContractUsd : financeContractUsd;
  const contractTzs = useTrucks ? truckContractUsd * fx : financeContractTzs;
  const advanceTzs = useTrucks ? truckAdvanceTzs : financeAdvanceTzs;
  const advanceUsd = advanceTzs / fx;

  // ── Expenses ──
  const verifiedTotal = expenses
    .filter((e) => VERIFIED_STATUSES.includes(String(e["status"] ?? "")))
    .reduce((s, e) => s + Number(e["amount"] ?? 0), 0);
  const pendingTotal = expenses
    .filter((e) => PENDING_STATUSES.includes(String(e["status"] ?? "")))
    .reduce((s, e) => s + Number(e["amount"] ?? 0), 0);
  const totalExpenses = verifiedTotal + pendingTotal;
  const cashRemaining = advanceTzs - verifiedTotal;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <Stat
        label="Contract total"
        value={usd(contractUsd)}
        sub={
          useTrucks
            ? `${trucks.length} truck${trucks.length === 1 ? "" : "s"} · ${tzs(contractTzs)}`
            : tzs(contractTzs)
        }
      />
      <Stat
        label="Advance paid"
        value={tzs(advanceTzs)}
        sub={`${usd(advanceUsd)} @ ${fx.toLocaleString()} TZS/USD`}
        tone="amber"
      />
      <Stat
        label="Fuel budget"
        value={`${truckFuelLitres.toLocaleString()} L`}
        sub={truckFuelCost > 0 ? tzs(truckFuelCost) : "No fuel budget set"}
      />
      <Stat
        label="Expenses logged"
        value={tzs(totalExpenses)}
        sub={`${tzs(verifiedTotal)} verified · ${tzs(pendingTotal)} pending`}
      />
      <Stat
        label="Driver cash remaining"
        value={tzs(cashRemaining)}
        sub="Advance − verified expenses"
        tone={cashRemaining < 0 ? "red" : "green"}
      />
    </div>
  );
}
