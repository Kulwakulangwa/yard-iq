import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { db } from "@/lib/db";
import { advanceAmount, tzs, usd } from "@/lib/money";
import { useFxRate } from "@/lib/fx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Finance = {
  contract_amount: number;
  fx_exchange_rate: number;
  advance_input_type: string;
  advance_value: number;
  advance_paid_usd: number;
  advance_paid_tzs: number;
  customer_paid_tzs: number;
};

export function TripFinance({ tripId }: { tripId: string }) {
  const defaultFx = useFxRate();

  const { data, isLoading } = useQuery({
    queryKey: ["trip-finance", tripId],
    queryFn: async () => {
      const { data, error } = await db
        .from("trip_financials")
        .select("*")
        .eq("trip_id", tripId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading trip finances…</p>;
  }

  const initial: Finance = {
    contract_amount: Number(data?.contract_amount ?? 0),
    fx_exchange_rate: Number(data?.fx_exchange_rate ?? defaultFx),
    advance_input_type: data?.advance_input_type ?? "percentage",
    advance_value: Number(data?.advance_value ?? 0),
    advance_paid_usd: Number(data?.advance_paid_usd ?? 0),
    advance_paid_tzs: Number(data?.advance_paid_tzs ?? 0),
    customer_paid_tzs: Number(data?.customer_paid_tzs ?? 0),
  };

  return (
    <FinanceForm
      key={`${tripId}-${data?.updated_at ?? "new"}`}
      tripId={tripId}
      initial={initial}
    />
  );
}

function FinanceForm({ tripId, initial }: { tripId: string; initial: Finance }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Finance>(initial);
  const [busy, setBusy] = useState(false);

  const totalTzs = draft.contract_amount * draft.fx_exchange_rate;
  const advanceUsd = advanceAmount(
    draft.contract_amount,
    draft.advance_input_type,
    draft.advance_value,
  );
  const advanceTzs = advanceUsd * draft.fx_exchange_rate;

  const num = (v: string) => (v === "" ? 0 : Number(v));

  async function save() {
    if (
      draft.fx_exchange_rate <= 0 ||
      draft.contract_amount < 0 ||
      draft.advance_value < 0 ||
      (draft.advance_input_type === "percentage" && draft.advance_value > 100) ||
      advanceUsd > draft.contract_amount
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
        contract_currency: "USD",
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
      {/* ── Freight Contract ─────────────────────────────────── */}
      <section className="rounded-lg border bg-muted/20 p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Freight Contract
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="mb-1.5 block text-sm font-medium">
              Total contract (USD)
            </Label>
            <Input
              type="number"
              min="0"
              step="any"
              value={draft.contract_amount}
              onChange={(e) =>
                setDraft((d) => ({ ...d, contract_amount: num(e.target.value) }))
              }
            />
          </div>
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
        </div>
        <div className="mt-3 flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Total contract in TZS</span>
          <strong>{tzs(totalTzs)}</strong>
        </div>
      </section>

      {/* ── Driver Cash Advance ─────────────────────────────── */}
      <section className="rounded-lg border bg-muted/20 p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Driver Cash Advance
        </h3>

        {/* Radio pills */}
        <div className="mb-3 flex flex-wrap gap-5">
          {[
            { value: "percentage", label: "Percentage of contract" },
            { value: "fixed", label: "Fixed USD amount" },
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

        {/* Advance input */}
        <div className="mb-3">
          <Label className="mb-1.5 block text-sm font-medium">
            {draft.advance_input_type === "percentage" ? "Advance %" : "Advance USD"}
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

        {/* Computed tiles */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border bg-card p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Advance USD
            </div>
            <div className="mt-1 text-lg font-semibold text-warning-foreground">
              {usd(advanceUsd)}
            </div>
          </div>
          <div className="rounded-md border bg-card p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Advance TZS
            </div>
            <div className="mt-1 text-lg font-semibold text-warning-foreground">
              {tzs(advanceTzs)}
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
