import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { db } from "@/lib/db";
import { tzs, usd } from "@/lib/money";
import { useFxRate } from "@/lib/fx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TripFinance({ tripId }: { tripId: string }) {
  const fx = useFxRate();
  const qc = useQueryClient();
  const [customerPaid, setCustomerPaid] = useState("0");
  const [busy, setBusy] = useState(false);

  const { data: trucks = [] } = useQuery({
    queryKey: ["trip-vehicles", tripId],
    queryFn: async () => {
      const { data, error } = await db
        .from("trip_vehicles")
        .select("*")
        .eq("trip_id", tripId);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: finance } = useQuery({
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

  useEffect(() => {
    if (finance) setCustomerPaid(String(finance.customer_paid_tzs ?? 0));
  }, [finance]);

  const totalContractUsd = trucks.reduce(
    (s, t) => s + Number(t.contract_amount ?? 0),
    0,
  );
  const totalContractTzs = totalContractUsd * fx;
  const totalAdvanceTzs = trucks.reduce(
    (s, t) =>
      s + Number(t.advance_paid_tzs ?? 0) + Number(t.advance_paid_usd ?? 0) * fx,
    0,
  );
  const totalAdvanceUsd = totalAdvanceTzs / fx;
  const paid = Number(customerPaid || 0);
  const balance = totalContractTzs - paid;

  async function save() {
    setBusy(true);
    const { error } = await db.from("trip_financials").upsert(
      {
        trip_id: tripId,
        contract_currency: "USD",
        contract_amount: totalContractUsd,
        fx_exchange_rate: fx,
        advance_input_type: "fixed",
        advance_value: totalAdvanceUsd,
        advance_paid_usd: totalAdvanceUsd,
        advance_paid_tzs: totalAdvanceTzs,
        customer_paid_tzs: paid,
      },
      { onConflict: "trip_id" },
    );
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["trip-finance", tripId] });
    qc.invalidateQueries({ queryKey: ["trip-summary", tripId] });
    qc.invalidateQueries({ queryKey: ["office-dashboard"] });
    toast.success("Trip totals saved");
  }

  return (
    <section className="border-t pt-4">
      <h2 className="mb-1 font-semibold">Trip totals</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Contract value and advances are summed from the trucks above. Only the
        customer payment is editable here.
      </p>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md border p-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {trucks.length} truck{trucks.length === 1 ? "" : "s"} · Contract
          </div>
          <div className="mt-1 text-lg font-semibold">{usd(totalContractUsd)}</div>
          <div className="text-xs text-muted-foreground">{tzs(totalContractTzs)}</div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Advance paid
          </div>
          <div className="mt-1 text-lg font-semibold text-warning-foreground">
            {tzs(totalAdvanceTzs)}
          </div>
          <div className="text-xs text-muted-foreground">{usd(totalAdvanceUsd)}</div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Customer paid
          </div>
          <div className="mt-1 text-lg font-semibold">{tzs(paid)}</div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Balance
          </div>
          <div
            className={`mt-1 text-lg font-semibold ${
              balance > 0 ? "text-warning-foreground" : ""
            }`}
          >
            {tzs(balance)}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="tf-customer" className="mb-1.5 block text-xs text-muted-foreground">
            Customer paid (TZS)
          </Label>
          <Input
            id="tf-customer"
            type="number"
            min="0"
            step="any"
            value={customerPaid}
            onChange={(e) => setCustomerPaid(e.target.value)}
          />
        </div>
        <div className="flex items-end text-xs text-muted-foreground">
          <span>
            FX rate: <strong>{fx.toLocaleString()}</strong> TZS/USD
            <br />
            Change in Settings.
          </span>
        </div>
      </div>

      <Button className="mt-3" onClick={save} disabled={busy}>
        {busy ? "Saving…" : "Save customer payment"}
      </Button>
    </section>
  );
}
