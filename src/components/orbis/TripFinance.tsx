import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Link2 } from "lucide-react";
import { toast } from "sonner";

import { db } from "@/lib/db";
import { tzs, usd } from "@/lib/money";
import { useFxRate } from "@/lib/fx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Finance = {
  contract_amount: number;
  contract_currency: string;
  fx_exchange_rate: number;
  advance_input_type: string;
  advance_value: number;
  advance_paid_usd: number;
  advance_paid_tzs: number;
  customer_paid_tzs: number;
};

export function TripFinance({ tripId }: { tripId: string }) {
  const defaultFx = useFxRate();

  // Look up the trip's linked contract + the finance row in one shot.
  const { data, isLoading } = useQuery({
    queryKey: ["trip-finance-full", tripId],
    queryFn: async () => {
      const [tripResult, financeResult] = await Promise.all([
        db
          .from("trips")
          .select("id, contract_id, customer_id")
          .eq("id", tripId)
          .maybeSingle(),
        db.from("trip_financials").select("*").eq("trip_id", tripId).maybeSingle(),
      ]);
      if (tripResult.error) throw tripResult.error;
      if (financeResult.error) throw financeResult.error;

      const trip = tripResult.data as { id: string; contract_id: string | null; customer_id: string | null } | null;
      let contract: any = null;

      if (trip?.contract_id) {
        const { data: c, error: cErr } = await db
          .from("contracts")
          .select("*")
          .eq("id", trip.contract_id)
          .maybeSingle();
        if (cErr) throw cErr;
        contract = c;
      }

      return { trip, contract, finance: financeResult.data };
    },
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading trip finances…</p>;
  }

  const contract: any = data?.contract ?? null;

  // Contract is the source of truth for amount + currency.
  // Fall back to whatever was previously saved on trip_financials.
  const initial: Finance = {
    contract_amount: Number(
      contract?.contract_amount ?? data?.finance?.contract_amount ?? 0,
    ),
    contract_currency: String(
      contract?.contract_currency ?? data?.finance?.contract_currency ?? "USD",
    ),
    fx_exchange_rate: Number(data?.finance?.fx_exchange_rate ?? defaultFx),
    advance_input_type: data?.finance?.advance_input_type ?? "percentage",
    advance_value: Number(data?.finance?.advance_value ?? 0),
    advance_paid_usd: Number(data?.finance?.advance_paid_usd ?? 0),
    advance_paid_tzs: Number(data?.finance?.advance_paid_tzs ?? 0),
    customer_paid_tzs: Number(data?.finance?.customer_paid_tzs ?? 0),
  };

  return (
    <FinanceForm
      key={`${tripId}-${data?.finance?.updated_at ?? "new"}-${contract?.updated_at ?? "noc"}`}
      tripId={tripId}
      contract={contract}
      initial={initial}
    />
  );
}

function FinanceForm({
  tripId,
  contract,
  initial,
}: {
  tripId: string;
  contract: any | null;
  initial: Finance;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Finance>(initial);
  const [busy, setBusy] = useState(false);

  const rate = draft.fx_exchange_rate > 0 ? draft.fx_exchange_rate : 1;
  const isUsd = draft.contract_currency === "USD";
  const hasContract = Boolean(contract);

  // ─── Contract in both currencies ────────────────────────
  const contractTzs = isUsd ? draft.contract_amount * rate : draft.contract_amount;
  const contractUsd = isUsd ? draft.contract_amount : draft.contract_amount / rate;

  // ─── Advance: percentage of contract, or fixed in contract currency ───
  const advanceTzs =
    draft.advance_input_type === "percentage"
      ? (contractTzs * draft.advance_value) / 100
      : isUsd
        ? draft.advance_value * rate
        : draft.advance_value;

  const advanceUsd = advanceTzs / rate;

  const num = (v: string) => (v === "" ? 0 : Number(v));

  async function save() {
    if (
      draft.fx_exchange_rate <= 0 ||
      draft.contract_amount < 0 ||
      draft.advance_value < 0 ||
      (draft.advance_input_type === "percentage" && draft.advance_value > 100) ||
      advanceTzs > contractTzs
    ) {
      toast.error(
        "Enter valid amounts, a positive exchange rate, and an advance within the contract value.",
      );
      return;
    }
    setBusy(true);
    const { error } = await db.from("trip_financials").upsert(
      {
        trip_id: tripId,
        contract_currency: draft.contract_currency,
        contract_amount: draft.contract_amount,
        fx_exchange_rate: draft.fx_exchange_rate,
        advance_input_type: draft.advance_input_type,
        advance_value: draft.advance_value,
        advance_paid_usd: advanceUsd,
        advance_paid_tzs: advanceTzs,
        customer_paid_tzs: draft.customer_paid_tzs,
      },
      { onConflict: "trip_id" },
    );
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await qc.invalidateQueries();
    toast.success("Trip finances saved");
  }

  return (
    <div className="space-y-4 border-t pt-4">
      {/* ── Contract details (reference) ────────────────────── */}
      {hasContract ? (
        <section className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Link2 className="size-4 text-primary" />
            <h3 className="text-xs font-semibold uppercase tracking-wide text-primary">
              Contract details
            </h3>
          </div>

          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div className="min-w-0">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Route
              </dt>
              <dd className="mt-0.5 truncate font-medium">
                {contract.route || "—"}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Origin
              </dt>
              <dd className="mt-0.5 truncate font-medium">
                {contract.origin || "—"}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Destination
              </dt>
              <dd className="mt-0.5 truncate font-medium">
                {contract.destination || "—"}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Distance
              </dt>
              <dd className="mt-0.5 font-medium">
                {Number(contract.distance_km ?? 0).toLocaleString()} km
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Outbound rate
              </dt>
              <dd className="mt-0.5 font-medium">
                {contract.contract_currency ?? "USD"}{" "}
                {Number(contract.rate_go ?? 0).toLocaleString()} / km
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Return rate
              </dt>
              <dd className="mt-0.5 font-medium">
                {contract.contract_currency ?? "USD"}{" "}
                {Number(contract.rate_return ?? 0).toLocaleString()} / km
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Total tonnage
              </dt>
              <dd className="mt-0.5 font-medium">
                {Number(contract.total_ton ?? 0).toLocaleString()} T
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Trucks on contract
              </dt>
              <dd className="mt-0.5 font-medium">
                {Number(contract.total_trucks ?? 0).toLocaleString()}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Contract amount
              </dt>
              <dd className="mt-0.5 font-semibold">
                {contract.contract_currency ?? "USD"}{" "}
                {Number(contract.contract_amount ?? 0).toLocaleString()}
              </dd>
            </div>
          </dl>

          <p className="mt-3 text-[11px] text-muted-foreground">
            These values come from the linked contract. To change them, edit the
            contract itself.
          </p>
        </section>
      ) : (
        <section className="rounded-lg border border-warning/40 bg-warning/5 p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
            <div className="text-sm">
              <p className="font-medium text-warning-foreground">
                No contract linked to this trip
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Close this dialog, edit the trip, and pick a Contract from the
                dropdown. The amount, currency and route will fill automatically.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── Freight Contract (editable remainder) ───────────── */}
      <section className="rounded-lg border bg-muted/20 p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Freight Contract
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="mb-1.5 block text-sm font-medium">
              Total contract amount
              {hasContract ? (
                <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                  (from contract)
                </span>
              ) : null}
            </Label>
            <Input
              type="number"
              min="0"
              step="any"
              value={draft.contract_amount}
              readOnly={hasContract}
              onChange={(e) =>
                setDraft((d) => ({ ...d, contract_amount: num(e.target.value) }))
              }
              className={hasContract ? "cursor-default bg-muted/40" : undefined}
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm font-medium">
              Currency
              {hasContract ? (
                <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                  (from contract)
                </span>
              ) : null}
            </Label>
            <select
              value={draft.contract_currency}
              disabled={hasContract}
              onChange={(e) =>
                setDraft((d) => ({ ...d, contract_currency: e.target.value }))
              }
              className={`h-9 w-full rounded-md border border-input bg-background px-3 text-sm ${
                hasContract ? "cursor-not-allowed opacity-70" : ""
              }`}
            >
              <option value="TZS">TZS</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="mb-1.5 block text-sm font-medium">
              FX rate (1 USD = TZS)
            </Label>
            <Input
              type="number"
              min="0"
              step="any"
              value={draft.fx_exchange_rate}
              onChange={(e) =>
                setDraft((d) => ({ ...d, fx_exchange_rate: num(e.target.value) }))
              }
            />
          </div>
          <div className="flex items-end">
            <p className="text-xs text-muted-foreground">
              Default rate from Settings. Change only if this trip uses a different rate.
            </p>
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border bg-card p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Contract TZS
            </div>
            <div className="mt-1 text-lg font-semibold">{tzs(contractTzs)}</div>
          </div>
          <div className="rounded-md border bg-card p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Contract USD
            </div>
            <div className="mt-1 text-lg font-semibold">{usd(contractUsd)}</div>
          </div>
        </div>
      </section>

      {/* ── Driver Cash Advance ─────────────────────────────── */}
      <section className="rounded-lg border bg-muted/20 p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Driver Cash Advance
        </h3>

        <div className="mb-3 flex flex-wrap gap-5">
          {[
            { value: "percentage", label: "Percentage of contract" },
            { value: "fixed", label: `Fixed ${draft.contract_currency} amount` },
          ].map((opt) => {
            const active = draft.advance_input_type === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  setDraft((d) => ({ ...d, advance_input_type: opt.value }))
                }
                className="flex items-center gap-2 text-sm"
              >
                <span
                  className={`flex size-4 items-center justify-center rounded-full border-2 ${
                    active ? "border-warning-foreground" : "border-muted-foreground/40"
                  }`}
                >
                  {active ? (
                    <span className="size-2 rounded-full bg-warning-foreground" />
                  ) : null}
                </span>
                <span className={active ? "font-medium" : "text-muted-foreground"}>
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mb-3">
          <Label className="mb-1.5 block text-sm font-medium">
            {draft.advance_input_type === "percentage"
              ? "Advance %"
              : `Advance (${draft.contract_currency})`}
          </Label>
          <Input
            type="number"
            min="0"
            step="any"
            value={draft.advance_value}
            onChange={(e) =>
              setDraft((d) => ({ ...d, advance_value: num(e.target.value) }))
            }
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border bg-card p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Advance TZS
            </div>
            <div className="mt-1 text-lg font-semibold text-warning-foreground">
              {tzs(advanceTzs)}
            </div>
          </div>
          <div className="rounded-md border bg-card p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Advance USD
            </div>
            <div className="mt-1 text-lg font-semibold text-warning-foreground">
              {usd(advanceUsd)}
            </div>
          </div>
        </div>
      </section>

      <Button onClick={save} disabled={busy}>
        {busy ? "Saving…" : "Save finances"}
      </Button>
    </div>
  );
}
