import { Stat } from "./Stat";
import { tzs, usd, dualDisplay } from "@/lib/money";
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
  const rate = fx > 0 ? fx : 2600;

  // ─── Contract ─────────────────────────────────────────
  const contractTzs = Number(finance?.["total_contract_tzs"] ?? 0);
  const contractUsd =
    finance?.["contract_currency"] === "USD"
      ? Number(finance["contract_amount"] ?? 0)
      : contractTzs / rate;

  // ─── Advance ──────────────────────────────────────────
  const advanceTzs =
    Number(finance?.["advance_paid_tzs"] ?? 0) +
    Number(finance?.["advance_paid_usd"] ?? 0) * rate;
  const advanceUsd = advanceTzs / rate;

  // ─── Expenses (per-row currency aware) ────────────────
  const verifiedTzs = expenses
    .filter((e) => VERIFIED_STATUSES.includes(String(e["status"] ?? "")))
    .reduce(
      (s, e) =>
        s +
        dualDisplay(Number(e["amount"] ?? 0), String(e["currency"] ?? "TZS"), rate).tzsValue,
      0,
    );

  const pendingTzs = expenses
    .filter((e) => PENDING_STATUSES.includes(String(e["status"] ?? "")))
    .reduce(
      (s, e) =>
        s +
        dualDisplay(Number(e["amount"] ?? 0), String(e["currency"] ?? "TZS"), rate).tzsValue,
      0,
    );

  const totalTzs = verifiedTzs + pendingTzs;
  const totalUsd = totalTzs / rate;

  const cashRemainingTzs = advanceTzs - verifiedTzs;
  const cashRemainingUsd = cashRemainingTzs / rate;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Stat
        label="Contract total"
        value={tzs(contractTzs)}
        sub={`${usd(contractUsd)} @ ${rate.toLocaleString()} TZS/USD`}
      />
      <Stat
        label="Advance paid"
        value={tzs(advanceTzs)}
        sub={`${usd(advanceUsd)} @ ${rate.toLocaleString()} TZS/USD`}
        tone="amber"
      />
      <Stat
        label="Expenses logged"
        value={tzs(totalTzs)}
        sub={`${usd(totalUsd)} · ${expenses.length} entr${expenses.length === 1 ? "y" : "ies"}`}
      />
      <Stat
        label="Driver cash remaining"
        value={tzs(cashRemainingTzs)}
        sub={usd(cashRemainingUsd)}
        tone={cashRemainingTzs < 0 ? "red" : "green"}
      />
    </div>
  );
}
