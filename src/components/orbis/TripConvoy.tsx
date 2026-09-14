import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { db, selectAll } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Draft = { vehicle_id: string; trailer_id: string; driver_id: string; role: string; notes: string };
const empty: Draft = { vehicle_id: "", trailer_id: "", driver_id: "", role: "Convoy", notes: "" };

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

  const { data: vehicles = [] } = useQuery({ queryKey: ["vehicles"], queryFn: () => selectAll("vehicles", "id, registration_number") });
  const { data: drivers = [] } = useQuery({ queryKey: ["drivers"], queryFn: () => selectAll("drivers", "id, full_name") });

  const label = (list: any[], id: unknown, key: string) =>
    list.find((r) => String(r.id) === String(id))?.[key] ?? "—";

  const add = useMutation({
    mutationFn: async () => {
      if (!draft.vehicle_id) throw new Error("Choose a vehicle first.");
      const { error } = await db.from("trip_vehicles").insert({
        trip_id: tripId,
        vehicle_id: draft.vehicle_id,
        trailer_id: draft.trailer_id || null,
        driver_id: draft.driver_id || null,
        role: draft.role || "Convoy",
        notes: draft.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft(empty);
      qc.invalidateQueries({ queryKey: ["trip-vehicles", tripId] });
      toast.success("Vehicle added to the trip");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("trip_vehicles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trip-vehicles", tripId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="border-t pt-4">
      <h2 className="mb-1 font-semibold">Vehicles on this trip</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Add extra trucks when several vehicles travel as one bundle. The trip&apos;s main vehicle and driver stay as set above.
      </p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No extra vehicles yet.</p>
      ) : (
        <ul className="mb-3 divide-y rounded-md border">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span>
                <span className="font-medium">{label(vehicles, r.vehicle_id, "registration_number")}</span>
                {" · "}
                {label(drivers, r.driver_id, "full_name")}
                {r.trailer_id ? ` · trailer ${label(vehicles, r.trailer_id, "registration_number")}` : ""}
                <span className="ml-2 text-muted-foreground">{r.role}</span>
              </span>
              <Button variant="ghost" size="sm" onClick={() => remove.mutate(String(r.id))}>
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="tv-vehicle" className="mb-1.5 block text-xs text-muted-foreground">Vehicle</Label>
          <select
            id="tv-vehicle"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={draft.vehicle_id}
            onChange={(e) => setDraft((d) => ({ ...d, vehicle_id: e.target.value }))}
          >
            <option value="">—</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>{v.registration_number}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="tv-driver" className="mb-1.5 block text-xs text-muted-foreground">Driver</Label>
          <select
            id="tv-driver"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={draft.driver_id}
            onChange={(e) => setDraft((d) => ({ ...d, driver_id: e.target.value }))}
          >
            <option value="">—</option>
            {drivers.map((v) => (
              <option key={v.id} value={v.id}>{v.full_name}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="tv-trailer" className="mb-1.5 block text-xs text-muted-foreground">Trailer</Label>
          <select
            id="tv-trailer"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={draft.trailer_id}
            onChange={(e) => setDraft((d) => ({ ...d, trailer_id: e.target.value }))}
          >
            <option value="">—</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>{v.registration_number}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="tv-role" className="mb-1.5 block text-xs text-muted-foreground">Role</Label>
          <select
            id="tv-role"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={draft.role}
            onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))}
          >
            {["Convoy", "Lead", "Support", "Escort"].map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="tv-notes" className="mb-1.5 block text-xs text-muted-foreground">Note</Label>
          <Input id="tv-notes" value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} />
        </div>
      </div>
      <Button className="mt-3" variant="outline" onClick={() => add.mutate()} disabled={add.isPending}>
        {add.isPending ? "Adding…" : "Add vehicle to trip"}
      </Button>
    </section>
  );
}
