import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { advanceAmount, tzs, usd } from "@/lib/money";
import { useFxRate } from "@/lib/fx";
import { toast } from "sonner";

type Finance = { contract_amount: number; fx_exchange_rate: number; advance_input_type: string; advance_value: number; advance_paid_tzs: number; advance_paid_usd: number; customer_paid_tzs: number };
export function TripFinance({ tripId }: { tripId: string }) {
  const fx = useFxRate();
  const defaults: Finance = { contract_amount: 0, fx_exchange_rate: fx, advance_input_type: "percentage", advance_value: 0, advance_paid_tzs: 0, advance_paid_usd: 0, customer_paid_tzs: 0 };
  const query = useQuery({ queryKey: ["trip-finance", tripId], queryFn: async () => {
    const { data, error } = await supabase.from("trip_financials").select("*").eq("trip_id", tripId).maybeSingle();
    if (error) throw error;
    return data;
  }});
  if (query.isPending) return <p>Loading trip finances…</p>;
  if (query.error) return <p role="alert" className="text-destructive">{query.error.message}</p>;
  if (query.data && query.data.contract_currency !== "USD") return <p>Existing {query.data.contract_currency} contract preserved. Currency conversion requires review.</p>;
  return <FinanceForm key={`${tripId}-${query.data?.updated_at ?? "new"}`} tripId={tripId} initial={query.data ?? defaults} />;
}
function FinanceForm({ tripId, initial }: { tripId: string; initial: Finance }) {
  const [draft, setDraft] = useState<Finance>(initial);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const total = draft.contract_amount * draft.fx_exchange_rate;
  const advance = advanceAmount(draft.contract_amount, draft.advance_input_type, draft.advance_value);
  async function save() {
    if (Object.values(draft).some(v => typeof v === "number" && (!Number.isFinite(v) || v < 0)) || draft.fx_exchange_rate <= 0 || (draft.advance_input_type === "percentage" && draft.advance_value > 100) || advance > draft.contract_amount) {
      toast.error("Enter valid amounts, a positive exchange rate, and an advance within the contract value."); return;
    }
    setBusy(true);
    const { error } = await supabase.from("trip_financials").upsert({ trip_id: tripId, contract_currency: "USD", contract_amount: draft.contract_amount, fx_exchange_rate: draft.fx_exchange_rate, advance_input_type: draft.advance_input_type, advance_value: draft.advance_value, advance_paid_tzs: draft.advance_paid_tzs, advance_paid_usd: draft.advance_paid_usd, customer_paid_tzs: draft.customer_paid_tzs }, { onConflict: "trip_id" });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries();
    toast.success("Trip finances saved");
  }
  return <section className="border-t pt-4">
    <h2 className="mb-3 font-semibold">Border trip finances</h2>
    <div className="grid gap-3 sm:grid-cols-2">
      {([
        ["contract_amount", "Contract amount (USD)"], ["fx_exchange_rate", "Exchange rate (TZS per USD)"],
        ["advance_value", draft.advance_input_type === "percentage" ? "Driver advance (%)" : "Driver advance (USD)"],
        ["advance_paid_tzs", "Advance paid (TZS)"], ["advance_paid_usd", "Advance paid (USD)"], ["customer_paid_tzs", "Customer paid (TZS)"],
      ] as [keyof Finance, string][]).map(([key, label]) => <div key={key}><Label htmlFor={`money-${key}`}>{label}</Label><Input id={`money-${key}`} type="number" min="0" step="any" value={draft[key]} onChange={e => setDraft(d => ({ ...d, [key]: Number(e.target.value) }))} /></div>)}
      <div><Label htmlFor="advance-type">Advance type</Label><select id="advance-type" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.advance_input_type} onChange={e => setDraft(d => ({ ...d, advance_input_type: e.target.value }))}><option value="percentage">Percentage</option><option value="fixed">Fixed USD amount</option></select></div>
    </div>
    <dl className="my-4 grid gap-3 text-sm sm:grid-cols-2">
      <div><dt className="text-muted-foreground">Contract value</dt><dd>{tzs(total)} · {usd(draft.contract_amount)}</dd></div>
      <div><dt className="text-muted-foreground">Planned driver advance</dt><dd>{tzs(advance * draft.fx_exchange_rate)} · {usd(advance)}</dd></div>
      <div><dt className="text-muted-foreground">Customer balance</dt><dd>{tzs(total - draft.customer_paid_tzs)}</dd></div>
    </dl>
    <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save trip finances"}</Button>
  </section>;
}
