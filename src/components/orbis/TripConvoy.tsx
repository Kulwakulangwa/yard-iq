import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { db, selectAll } from "@/lib/db";
import { tzs, usd } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Draft = {
  vehicle_id: string;
  trailer_id: string;
  driver_id: string;
  role: string;
  contract_amount: string;
  advance_paid_usd: string;
  advance_paid_tzs: string;
  fuel_budget_litres: string;
  fuel_budget_cost: string;
  notes: string;
};

const empty: Draft = {
  vehicle_id: "",
  trailer_id: "",
  driver_id: "",
  role: "Convoy",
  contract_amount: "",
  advance_paid_usd: "",
  advance_paid_tzs: "",
  fuel_budget_litres: "",
  fuel_budget_cost: "",
  notes: "",
};

export function TripConvoy({ tripId }: { tripId: string }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft>(empty);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["trip-vehicles", tripId],
    queryFn: async () => {
      const { data, error } = await db
        .from("trip_vehicles")
        .select("*")
        .eq("trip_id", tripId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => selectAll("vehicles", "id, registration_number, is_trailer"),
  });
  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers"],
    queryFn: () => selectAll("drivers", "id, full_name"),
  });

  const trucks = vehicles.filter((v: any) => !v.is_trailer);
  const trailers = vehicles.filter((v: any) => v.is_trailer);

  const label = (list: any[], id: unknown, key: string) =>
    list.find((r) => String(r.id) === String(id))?.[key] ?? "—";

  const add = useMutation({
    mutationFn: async () => {
      if (!draft.vehicle_id) throw new Error("Choose a truck first.");
      const { error } = await db.from("trip_vehicles").insert({
        trip_id: tripId,
        vehicle_id: draft.vehicle_id,
        trailer_id: draft.trailer_id || null,
        driver_id: draft.driver_id || null,
        role: draft.role || "Convoy",
        contract_amount: Number(draft.contract_amount || 0),
        contract_currency: "USD",
        advance_paid_usd: Number(draft.advance_paid_usd || 0),
        advance_paid_tzs: Number(draft.advance_paid_tzs || 0),
        fuel_budget_litres: Number(draft.fuel_budget_litres || 0),
        fuel_budget_cost: Number(draft.fuel_budget_cost || 0),
        notes: draft.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft(empty);
      qc.invalidateQueries({ queryKey: ["trip-vehicles", tripId] });
      qc.invalidateQueries({ queryKey: ["trip-summary", tripId] });
      qc.invalidateQueries({ queryKey: ["convoy-legs"] });
      qc.invalidateQueries({ queryKey: ["fleet-overview"] });
      toast.success("Truck added to the trip");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("trip_vehicles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trip-vehicles", tripId] });
      qc.invalidateQueries({ queryKey: ["trip-summary", tripId] });
      qc.invalidateQueries({ queryKey: ["convoy-legs"] });
      qc.invalidateQueries({ queryKey: ["fleet-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalContractUsd = rows.reduce((s, r) => s + Number(r.contract_amount ?? 0), 0);
  const totalAdvanceTzs = rows.reduce(
    (s, r) => s + Number(r.advance_paid_tzs ?? 0) + Number(r.advance_paid_usd ?? 0) * 2600,
    0,
  );
  const totalFuelLitres = rows.reduce((s, r) => s + Number(r.fuel_budget_litres ?? 0), 0);
  const totalFuelCost = rows.reduce((s, r) => s + Number(r.fuel_budget_cost ?? 0), 0);

  return (
    <section className="border-t pt-4">
      <h2 className="mb-1 font-semibold">Trucks on this trip</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        One row per truck, each with its own driver, trailer, contract and fuel budget.
      </p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No trucks assigned yet.</p>
      ) : (
        <>
          <ul className="mb-3 divide-y rounded-md border">
            {rows.map((r) => (
              <li key={r.id} className="px-3 py-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {label(vehicles, r.vehicle_id, "registration_number")}
                      </span>
                      <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
                        {r.role}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Driver {label(drivers, r.driver_id, "full_name")}
                      {r.trailer_id
                        ? ` · trailer ${label(vehicles, r.trailer_id, "registration_number")}`
                        : ""}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      <span>
                        Contract <strong>{usd(r.contract_amount)}</strong>
                      </span>
                      <span>
                        Advance USD <strong>{usd(r.advance_paid_usd)}</strong>
                      </span>
                      <span>
                        Advance TZS <strong>{tzs(r.advance_paid_tzs)}</strong>
                      </span>
                      <span>
                        Fuel{" "}
                        <strong>
                          {Number(r.fuel_budget_litres ?? 0).toLocaleString()} L ·{" "}
                          {tzs(r.fuel_budget_cost)}
                        </strong>
                      </span>
                    </div>
                    {r.notes ? (
                      <div className="mt-1 text-xs text-muted-foreground">{r.notes}</div>
                    ) : null}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => remove.mutate(String(r.id))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <div className="mb-3 grid gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <span className="text-muted-foreground">Trucks: </span>
              <strong>{rows.length}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Contract: </span>
              <strong>{usd(totalContractUsd)}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Advance: </span>
              <strong>{tzs(totalAdvanceTzs)}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Fuel budget: </span>
              <strong>
                {totalFuelLitres.toLocaleString()} L · {tzs(totalFuelCost)}
              </strong>
            </div>
          </div>
        </>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="tv-vehicle" className="mb-1.5 block text-xs text-muted-foreground">
            Truck
          </Label>
          <select
            id="tv-vehicle"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={draft.vehicle_id}
            onChange={(e) => setDraft((d) => ({ ...d, vehicle_id: e.target.value }))}
          >
            <option value="">—</option>
            {trucks.map((v: any) => (
              <option key={v.id} value={v.id}>
                {v.registration_number}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="tv-driver" className="mb-1.5 block text-xs text-muted-foreground">
            Driver
          </Label>
          <select
            id="tv-driver"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={draft.driver_id}
            onChange={(e) => setDraft((d) => ({ ...d, driver_id: e.target.value }))}
          >
            <option value="">—</option>
            {drivers.map((v: any) => (
              <option key={v.id} value={v.id}>
                {v.full_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="tv-trailer" className="mb-1.5 block text-xs text-muted-foreground">
            Trailer
          </Label>
          <select
            id="tv-trailer"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={draft.trailer_id}
            onChange={(e) => setDraft((d) => ({ ...d, trailer_id: e.target.value }))}
          >
            <option value="">—</option>
            {trailers.map((v: any) => (
              <option key={v.id} value={v.id}>
                {v.registration_number}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="tv-role" className="mb-1.5 block text-xs text-muted-foreground">
            Role
          </Label>
          <select
            id="tv-role"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={draft.role}
            onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))}
          >
            {["Lead", "Convoy", "Support", "Escort"].map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="tv-contract" className="mb-1.5 block text-xs text-muted-foreground">
            Contract amount (USD)
          </Label>
          <Input
            id="tv-contract"
            type="number"
            min="0"
            step="any"
            value={draft.contract_amount}
            onChange={(e) => setDraft((d) => ({ ...d, contract_amount: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="tv-adv-usd" className="mb-1.5 block text-xs text-muted-foreground">
            Advance paid (USD)
          </Label>
          <Input
            id="tv-adv-usd"
            type="number"
            min="0"
            step="any"
            value={draft.advance_paid_usd}
            onChange={(e) => setDraft((d) => ({ ...d, advance_paid_usd: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="tv-adv-tzs" className="mb-1.5 block text-xs text-muted-foreground">
            Advance paid (TZS)
          </Label>
          <Input
            id="tv-adv-tzs"
            type="number"
            min="0"
            step="any"
            value={draft.advance_paid_tzs}
            onChange={(e) => setDraft((d) => ({ ...d, advance_paid_tzs: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="tv-fuel-l" className="mb-1.5 block text-xs text-muted-foreground">
            Fuel budget (litres)
          </Label>
          <Input
            id="tv-fuel-l"
            type="number"
            min="0"
            step="any"
            value={draft.fuel_budget_litres}
            onChange={(e) => setDraft((d) => ({ ...d, fuel_budget_litres: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="tv-fuel-cost" className="mb-1.5 block text-xs text-muted-foreground">
            Fuel budget (TZS)
          </Label>
          <Input
            id="tv-fuel-cost"
            type="number"
            min="0"
            step="any"
            value={draft.fuel_budget_cost}
            onChange={(e) => setDraft((d) => ({ ...d, fuel_budget_cost: e.target.value }))}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="tv-notes" className="mb-1.5 block text-xs text-muted-foreground">
            Note
          </Label>
          <Input
            id="tv-notes"
            value={draft.notes}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
          />
        </div>
      </div>
      <Button
        className="mt-3"
        variant="outline"
        onClick={() => add.mutate()}
        disabled={add.isPending}
      >
        {add.isPending ? "Adding…" : "Add truck to trip"}
      </Button>
    </section>
  );
}
