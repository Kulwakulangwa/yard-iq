import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { db, selectAll } from "@/lib/db";
import { tzs, usd } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type Draft = {
  vehicle_id: string;
  trailer_id: string;
  driver_id: string;
  role: string;
  rate_per_km: string;
  round_trip: boolean;
  advance_paid_usd: string;
  advance_paid_tzs: string;
  notes: string;
};

const empty: Draft = {
  vehicle_id: "",
  trailer_id: "",
  driver_id: "",
  role: "Convoy",
  rate_per_km: "",
  round_trip: false,
  advance_paid_usd: "",
  advance_paid_tzs: "",
  notes: "",
};

export function TripConvoy({ tripId }: { tripId: string }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft>(empty);

  const { data: trip } = useQuery({
    queryKey: ["trip-distance", tripId],
    queryFn: async () => {
      const { data, error } = await db
        .from("trips")
        .select("id, planned_distance, trip_number")
        .eq("id", tripId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
  const distance = Number(trip?.planned_distance ?? 0);

  const computeValue = (ratePerKm: number, roundTrip: boolean) =>
    ratePerKm * distance * (roundTrip ? 2 : 1);

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
    queryFn: () => selectAll("vehicles", "id, registration_number"),
  });
  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers"],
    queryFn: () => selectAll("drivers", "id, full_name"),
  });

  const label = (list: any[], id: unknown, key: string) =>
    list.find((r) => String(r.id) === String(id))?.[key] ?? "—";

  const draftValue = computeValue(Number(draft.rate_per_km || 0), draft.round_trip);

  const add = useMutation({
    mutationFn: async () => {
      if (!draft.vehicle_id) throw new Error("Choose a vehicle first.");
      const rate = Number(draft.rate_per_km || 0);
      const value = computeValue(rate, draft.round_trip);
      const { error } = await db.from("trip_vehicles").insert({
        trip_id: tripId,
        vehicle_id: draft.vehicle_id,
        trailer_id: draft.trailer_id || null,
        driver_id: draft.driver_id || null,
        role: draft.role || "Convoy",
        rate_per_km: rate,
        round_trip: draft.round_trip,
        contract_amount: value,
        contract_currency: "USD",
        advance_paid_usd: Number(draft.advance_paid_usd || 0),
        advance_paid_tzs: Number(draft.advance_paid_tzs || 0),
        notes: draft.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft(empty);
      qc.invalidateQueries({ queryKey: ["trip-vehicles", tripId] });
      qc.invalidateQueries({ queryKey: ["trip-summary", tripId] });
      qc.invalidateQueries({ queryKey: ["convoy-legs"] });
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
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalValueUsd = rows.reduce((s, r) => s + Number(r.contract_amount ?? 0), 0);
  const totalAdvanceTzs = rows.reduce(
    (s, r) => s + Number(r.advance_paid_tzs ?? 0) + Number(r.advance_paid_usd ?? 0) * 2600,
    0,
  );

  return (
    <section className="border-t pt-4">
      <h2 className="mb-1 font-semibold">Trucks on this trip</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        One row per truck. Truck value = rate ×{" "}
        {distance > 0 ? `${distance.toLocaleString()} km` : "distance"} ×{" "}
        {`(round trip ? 2 : 1)`}.
      </p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No trucks assigned yet.</p>
      ) : (
        <>
          <ul className="mb-3 divide-y rounded-md border">
            {rows.map((r) => {
              const rate = Number(r.rate_per_km ?? 0);
              const value = Number(r.contract_amount ?? 0);
              return (
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
                        {r.round_trip ? (
                          <span className="rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-[11px] text-primary">
                            Round trip
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Driver {label(drivers, r.driver_id, "full_name")}
                        {r.trailer_id
                          ? ` · trailer ${label(vehicles, r.trailer_id, "registration_number")}`
                          : ""}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        <span>
                          Rate <strong>{usd(rate)}/km</strong>
                        </span>
                        <span>
                          Value{" "}
                          <strong>
                            {usd(value)}
                            {r.round_trip ? " (×2)" : ""}
                          </strong>
                        </span>
                        <span>
                          Advance USD <strong>{usd(r.advance_paid_usd)}</strong>
                        </span>
                        <span>
                          Advance TZS <strong>{tzs(r.advance_paid_tzs)}</strong>
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
              );
            })}
          </ul>
          <div className="mb-3 grid gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm sm:grid-cols-3">
            <div>
              <span className="text-muted-foreground">Trucks: </span>
              <strong>{rows.length}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Combined value: </span>
              <strong>{usd(totalValueUsd)}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Combined advance: </span>
              <strong>{tzs(totalAdvanceTzs)}</strong>
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
            {vehicles.map((v) => (
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
            {drivers.map((v) => (
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
            {vehicles.map((v) => (
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
          <Label htmlFor="tv-rate" className="mb-1.5 block text-xs text-muted-foreground">
            Rate per km (USD)
          </Label>
          <Input
            id="tv-rate"
            type="number"
            min="0"
            step="any"
            value={draft.rate_per_km}
            onChange={(e) => setDraft((d) => ({ ...d, rate_per_km: e.target.value }))}
          />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs text-muted-foreground">Round trip</Label>
          <div className="flex h-9 items-center gap-3 rounded-md border border-input bg-background px-3">
            <Switch
              id="tv-round"
              checked={draft.round_trip}
              onCheckedChange={(v) => setDraft((d) => ({ ...d, round_trip: v }))}
            />
            <span className="text-xs text-muted-foreground">
              {draft.round_trip ? "Distance × 2" : "One-way only"}
            </span>
          </div>
        </div>

        <div className="sm:col-span-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Computed truck value: </span>
          <strong>{usd(draftValue)}</strong>
          <span className="ml-2 text-xs text-muted-foreground">
            ({usd(Number(draft.rate_per_km || 0))}/km × {distance.toLocaleString()} km
            {draft.round_trip ? " × 2" : ""})
          </span>
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
