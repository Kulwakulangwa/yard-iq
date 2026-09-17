import { Stat } from "./Stat";
import { tzs, usd } from "@/lib/money";
import type { Row } from "./RecordEditor";

// Verified = money that has passed approval.
// Pending  = money still in review.
// Rejected = excluded entirely (not a real expense).
const VERIFIED_STATUSES = ["Approved", "Paid"];
const PENDING_STATUSES = ["Draft", "Submitted"];

export function TripSummaryCards({
  finance,
  expenses,
  fx,
}: {
  finance: Row | null;
  expenses: Row[];
  fx: number;
}) {
  const contractTzs = Number(finance?.["total_contract_tzs"] ?? 0);
  const contractUsd =
    finance?.["contract_currency"] === "USD"
      ? Number(finance["contract_amount"] ?? 0)
      : contractTzs / fx;

  const advanceTzs =
    Number(finance?.["advance_paid_tzs"] ?? 0) +
    Number(finance?.["advance_paid_usd"] ?? 0) * fx;
  const advanceUsd = advanceTzs / fx;

  const verifiedTotal = expenses
    .filter((e) => VERIFIED_STATUSES.includes(String(e["status"] ?? "")))
    .reduce((s, e) => s + Number(e["amount"] ?? 0), 0);

  const pendingTotal = expenses
    .filter((e) => PENDING_STATUSES.includes(String(e["status"] ?? "")))
    .reduce((s, e) => s + Number(e["amount"] ?? 0), 0);

  const totalExpenses = verifiedTotal + pendingTotal;
  const cashRemaining = advanceTzs - verifiedTotal;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Stat
        label="Contract total"
        value={usd(contractUsd)}
        sub={tzs(contractTzs)}
      />
      <Stat
        label="Advance paid"
        value={tzs(advanceTzs)}
        sub={`${usd(advanceUsd)} @ ${fx.toLocaleString()} TZS/USD`}
        tone="amber"
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
