import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { db, selectAll } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function relativeTime(iso: string | null | undefined) {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

type Draft = {
  location: string;
  checkpoint: string;
  reported_by: string;
  trip_vehicle_id: string;
  notes: string;
};

const empty: Draft = {
  location: "",
  checkpoint: "",
  reported_by: "",
  trip_vehicle_id: "",
  notes: "",
};

export function TripLocationLog({ tripId }: { tripId: string }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft>(empty);
  const [seeded, setSeeded] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["trip-locations", tripId],
    queryFn: async () => {
      const { data, error } = await db
        .from("trip_locations")
        .select("*")
        .eq("trip_id", tripId)
        .order("reported_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: convoy = [] } = useQuery({
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

  const vehicleLabel = (id: unknown) =>
    vehicles.find((v) => String(v.id) === String(id))?.registration_number ?? "Vehicle";

  const firstTruckId = convoy[0]?.id ? String(convoy[0].id) : "";

  // Seed the form with the first truck once convoy loads.
  useEffect(() => {
    if (!seeded && firstTruckId) {
      setDraft((d) => ({ ...d, trip_vehicle_id: firstTruckId }));
      setSeeded(true);
    }
  }, [firstTruckId, seeded]);

  // Reset back to "first truck" default after each save.
  function resetDraft() {
    setDraft({
      location: "",
      checkpoint: "",
      reported_by: "",
      trip_vehicle_id: firstTruckId,
      notes: "",
    });
  }

  const report = useMutation({
    mutationFn: async () => {
      if (!draft.location.trim()) throw new Error("Enter the current location.");
      const reportedAt = new Date().toISOString();
      const { error } = await db.from("trip_locations").insert({
        trip_id: tripId,
        trip_vehicle_id: draft.trip_vehicle_id || null,
        location: draft.location.trim(),
        checkpoint: draft.checkpoint || null,
        reported_by: draft.reported_by || null,
        reported_at: reportedAt,
        notes: draft.notes || null,
      });
      if (error) throw error;
      const { error: tripError } = await db
        .from("trips")
        .update({
          current_location: draft.location.trim(),
          current_location_at: reportedAt,
          current_location_by: draft.reported_by || null,
        })
        .eq("id", tripId);
      if (tripError) throw tripError;
    },
    onSuccess: () => {
      resetDraft();
      qc.invalidateQueries({ queryKey: ["trip-locations", tripId] });
      qc.invalidateQueries({ queryKey: ["trip-summary", tripId] });
      qc.invalidateQueries({ queryKey: ["convoy-legs"] });
      qc.invalidateQueries({ queryKey: ["trips"] });
      qc.invalidateQueries({ queryKey: ["office-dashboard"] });
      toast.success("Location updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const latest = rows[0];
  const latestTruck = latest?.trip_vehicle_id
    ? vehicleLabel(
        convoy.find((c) => String(c.id) === String(latest.trip_vehicle_id))?.vehicle_id,
      )
    : null;

  return (
    <section className="border-t pt-4">
      <h2 className="mb-1 font-semibold">Current location</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        {latest
          ? `${latestTruck ? `${latestTruck} · ` : ""}${latest.location}${latest.checkpoint ? ` (${latest.checkpoint})` : ""} — reported ${relativeTime(latest.reported_at)}${latest.reported_by ? ` by ${latest.reported_by}` : ""}`
          : "No location reported yet."}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="tl-location" className="mb-1.5 block text-xs text-muted-foreground">
            Location
          </Label>
          <Input
            id="tl-location"
            value={draft.location}
            onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="tl-checkpoint" className="mb-1.5 block text-xs text-muted-foreground">
            Checkpoint / border
          </Label>
          <Input
            id="tl-checkpoint"
            value={draft.checkpoint}
            onChange={(e) => setDraft((d) => ({ ...d, checkpoint: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="tl-officer" className="mb-1.5 block text-xs text-muted-foreground">
            Reported by
          </Label>
          <Input
            id="tl-officer"
            value={draft.reported_by}
            onChange={(e) => setDraft((d) => ({ ...d, reported_by: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="tl-vehicle" className="mb-1.5 block text-xs text-muted-foreground">
            Which truck is reporting?
          </Label>
          <select
            id="tl-vehicle"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={draft.trip_vehicle_id}
            onChange={(e) => setDraft((d) => ({ ...d, trip_vehicle_id: e.target.value }))}
          >
            <option value="">Whole trip (all trucks)</option>
            {convoy.map((c) => (
              <option key={c.id} value={c.id}>
                {vehicleLabel(c.vehicle_id)}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            {convoy.length > 1
              ? `Each truck can be at a different place — pick the one reporting. Use "Whole trip" only when they moved together.`
              : convoy.length === 1
                ? "The trip has one truck — this records against it."
                : "No trucks assigned to this trip yet."}
          </p>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="tl-notes" className="mb-1.5 block text-xs text-muted-foreground">
            Note
          </Label>
          <Input
            id="tl-notes"
            value={draft.notes}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
          />
        </div>
      </div>
      <Button
        className="mt-3"
        variant="outline"
        onClick={() => report.mutate()}
        disabled={report.isPending}
      >
        {report.isPending ? "Saving…" : "Record location update"}
      </Button>

      {isLoading ? null : rows.length > 0 ? (
        <ul className="mt-4 divide-y rounded-md border text-sm">
          {rows.map((r) => {
            const leg = convoy.find((c) => String(c.id) === String(r.trip_vehicle_id));
            return (
              <li key={r.id} className="px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  {r.trip_vehicle_id && leg ? (
                    <span className="rounded-full border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      {vehicleLabel(leg.vehicle_id)}
                    </span>
                  ) : (
                    <span className="rounded-full border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      Whole trip
                    </span>
                  )}
                  <span className="font-medium">{r.location}</span>
                  {r.checkpoint ? (
                    <span className="text-muted-foreground">· {r.checkpoint}</span>
                  ) : null}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {relativeTime(r.reported_at)}
                    {r.reported_by ? ` · ${r.reported_by}` : ""}
                  </span>
                </div>
                {r.notes ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">{r.notes}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
