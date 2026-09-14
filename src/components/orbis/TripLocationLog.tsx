import { useState } from "react";
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

type Draft = { location: string; checkpoint: string; reported_by: string; trip_vehicle_id: string; notes: string };
const empty: Draft = { location: "", checkpoint: "", reported_by: "", trip_vehicle_id: "", notes: "" };

export function TripLocationLog({ tripId }: { tripId: string }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft>(empty);

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
      const { data, error } = await db.from("trip_vehicles").select("*").eq("trip_id", tripId);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const { data: vehicles = [] } = useQuery({ queryKey: ["vehicles"], queryFn: () => selectAll("vehicles", "id, registration_number") });
  const vehicleLabel = (id: unknown) =>
    vehicles.find((v) => String(v.id) === String(id))?.registration_number ?? "Vehicle";

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
      setDraft(empty);
      qc.invalidateQueries({ queryKey: ["trip-locations", tripId] });
      qc.invalidateQueries({ queryKey: ["trips"] });
      toast.success("Location updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const latest = rows[0];

  return (
    <section className="border-t pt-4">
      <h2 className="mb-1 font-semibold">Current location</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        {latest
          ? `${latest.location}${latest.checkpoint ? ` (${latest.checkpoint})` : ""} — reported ${relativeTime(latest.reported_at)}${latest.reported_by ? ` by ${latest.reported_by}` : ""}`
          : "No location reported yet."}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="tl-location" className="mb-1.5 block text-xs text-muted-foreground">Location</Label>
          <Input id="tl-location" value={draft.location} onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))} />
        </div>
        <div>
          <Label htmlFor="tl-checkpoint" className="mb-1.5 block text-xs text-muted-foreground">Checkpoint / border</Label>
          <Input id="tl-checkpoint" value={draft.checkpoint} onChange={(e) => setDraft((d) => ({ ...d, checkpoint: e.target.value }))} />
        </div>
        <div>
          <Label htmlFor="tl-officer" className="mb-1.5 block text-xs text-muted-foreground">Reported by</Label>
          <Input id="tl-officer" value={draft.reported_by} onChange={(e) => setDraft((d) => ({ ...d, reported_by: e.target.value }))} />
        </div>
        <div>
          <Label htmlFor="tl-vehicle" className="mb-1.5 block text-xs text-muted-foreground">Vehicle (bundle trips)</Label>
          <select
            id="tl-vehicle"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={draft.trip_vehicle_id}
            onChange={(e) => setDraft((d) => ({ ...d, trip_vehicle_id: e.target.value }))}
          >
            <option value="">Whole trip</option>
            {convoy.map((c) => (
              <option key={c.id} value={c.id}>{vehicleLabel(c.vehicle_id)}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="tl-notes" className="mb-1.5 block text-xs text-muted-foreground">Note</Label>
          <Input id="tl-notes" value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} />
        </div>
      </div>
      <Button className="mt-3" variant="outline" onClick={() => report.mutate()} disabled={report.isPending}>
        {report.isPending ? "Saving…" : "Record location update"}
      </Button>

      {isLoading ? null : rows.length > 0 ? (
        <ul className="mt-4 divide-y rounded-md border text-sm">
          {rows.map((r) => (
            <li key={r.id} className="px-3 py-2">
              <span className="font-medium">{r.location}</span>
              {r.checkpoint ? ` · ${r.checkpoint}` : ""}
              {r.trip_vehicle_id ? ` · ${vehicleLabel(convoy.find((c) => c.id === r.trip_vehicle_id)?.vehicle_id)}` : ""}
              <span className="ml-2 text-muted-foreground">
                {relativeTime(r.reported_at)}
                {r.reported_by ? ` · ${r.reported_by}` : ""}
              </span>
              {r.notes ? <p className="text-muted-foreground">{r.notes}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
