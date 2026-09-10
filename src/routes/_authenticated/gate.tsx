import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { formatValue, logAudit, nextReference } from "@/lib/orbis";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/orbis/AppShell";
import { StatusBadge } from "@/components/orbis/StatusBadge";

export const Route = createFileRoute("/_authenticated/gate")({
  head: () => ({ meta: [{ title: "Gate Control — Orbis Logistics" }] }),
  component: GatePage,
});

const db = supabase as never as { from: (t: string) => any };

const ZONES = ["Main Gate", "Parking", "Loading Bay", "Unloading Bay", "Workshop", "Tire Store", "Exit Gate"];

async function raiseException(input: Record<string, unknown>) {
  const { data: existing } = await db.from("exceptions").select("exception_number");
  const number = nextReference(
    "EXC",
    ((existing ?? []) as any[]).map((e) => String(e.exception_number ?? "")),
  );
  await db.from("exceptions").insert({
    exception_number: number,
    status: "Open",
    required_approver: "Yard Supervisor",
    ...input,
  });
  return number;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function GatePage() {
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["gate-data"],
    queryFn: async () => {
      const [vehicles, drivers, trips, entries, loads, inspections, workOrders] = await Promise.all([
        db.from("vehicles").select("*").order("registration_number"),
        db.from("drivers").select("*").order("full_name"),
        db.from("trips").select("*"),
        db.from("gate_entries").select("*").order("event_time", { ascending: false }).limit(15),
        db.from("loads").select("*"),
        db.from("vehicle_inspections").select("*"),
        db.from("work_orders").select("*"),
      ]);
      return {
        vehicles: (vehicles.data ?? []) as any[],
        drivers: (drivers.data ?? []) as any[],
        trips: (trips.data ?? []) as any[],
        entries: (entries.data ?? []) as any[],
        loads: (loads.data ?? []) as any[],
        inspections: (inspections.data ?? []) as any[],
        workOrders: (workOrders.data ?? []) as any[],
      };
    },
  });

  return (
    <>
      <PageHeader title="Gate Control" subtitle="Record every vehicle entering and leaving the yard" />
      <Tabs defaultValue="in">
        <TabsList className="mb-4">
          <TabsTrigger value="in">Gate In</TabsTrigger>
          <TabsTrigger value="out">Gate Out</TabsTrigger>
        </TabsList>
        <TabsContent value="in">
          <GateIn data={data} onDone={() => qc.invalidateQueries()} />
        </TabsContent>
        <TabsContent value="out">
          <GateOut data={data} onDone={() => qc.invalidateQueries()} />
        </TabsContent>
      </Tabs>

      <Card className="mt-5 p-4">
        <h2 className="mb-3 font-semibold">Recent gate movements</h2>
        <ul className="divide-y text-sm">
          {(data?.entries ?? []).map((e) => {
            const v = data?.vehicles.find((x) => x.id === e.vehicle_id);
            return (
              <li key={e.id} className="flex flex-wrap items-center gap-2 py-2">
                <StatusBadge value={e.direction === "In" ? "Cleared" : e.decision} />
                <span className="font-medium">{v?.registration_number ?? "—"}</span>
                <span className="text-muted-foreground">Gate {e.direction}</span>
                <span className="ml-auto text-xs text-muted-foreground">{formatValue(e.event_time)}</span>
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}

function GateIn({ data, onDone }: { data: any; onDone: () => void }) {
  const [f, setF] = useState<Record<string, string>>({});
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const vehicle = data?.vehicles.find((v: any) => v.id === f["vehicle_id"]);
  const expectedTrip = data?.trips.find(
    (t: any) => t.vehicle_id === f["vehicle_id"] && ["Approved", "Ready for Yard", "Dispatched"].includes(t.status),
  );

  const save = useMutation({
    mutationFn: async () => {
      if (!f["vehicle_id"]) throw new Error("Choose a vehicle");
      const { error } = await db.from("gate_entries").insert({
        direction: "In",
        vehicle_id: f["vehicle_id"],
        driver_id: f["driver_id"] || null,
        trip_id: expectedTrip?.id ?? null,
        event_time: new Date().toISOString(),
        odometer: f["odometer"] ? Number(f["odometer"]) : null,
        vehicle_condition: f["vehicle_condition"] || null,
        yard_zone: f["yard_zone"] || "Parking",
        officer: f["officer"] || null,
        decision: "Cleared",
        notes: f["notes"] || null,
      });
      if (error) throw error;

      await db
        .from("vehicles")
        .update({
          status: "In Yard",
          yard_zone: f["yard_zone"] || "Parking",
          odometer: f["odometer"] ? Number(f["odometer"]) : vehicle?.odometer ?? null,
        })
        .eq("id", f["vehicle_id"]);

      await db.from("yard_movements").insert({
        vehicle_id: f["vehicle_id"],
        from_zone: "Main Gate",
        to_zone: f["yard_zone"] || "Parking",
        trip_id: expectedTrip?.id ?? null,
        reason: "Gate in",
        moved_at: new Date().toISOString(),
      });

      if (expectedTrip && f["driver_id"] && expectedTrip.driver_id && expectedTrip.driver_id !== f["driver_id"]) {
        const planned = data.drivers.find((d: any) => d.id === expectedTrip.driver_id)?.full_name ?? "—";
        const actual = data.drivers.find((d: any) => d.id === f["driver_id"])?.full_name ?? "—";
        await raiseException({
          exception_type: "Wrong Driver At Gate",
          expected_value: planned,
          actual_value: actual,
          vehicle_id: f["vehicle_id"],
          trip_id: expectedTrip.id,
          severity: "High",
        });
      }
      await logAudit("gate_in", "gate_entries", f["vehicle_id"], f);
    },
    onSuccess: () => {
      toast.success("Gate entry recorded");
      setF({});
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Vehicle">
          <select
            value={f["vehicle_id"] ?? ""}
            onChange={(e) => set("vehicle_id", e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">—</option>
            {(data?.vehicles ?? []).map((v: any) => (
              <option key={v.id} value={v.id}>
                {v.registration_number}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Driver at the wheel">
          <select
            value={f["driver_id"] ?? ""}
            onChange={(e) => set("driver_id", e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">—</option>
            {(data?.drivers ?? []).map((d: any) => (
              <option key={d.id} value={d.id}>
                {d.full_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Odometer">
          <Input type="number" value={f["odometer"] ?? ""} onChange={(e) => set("odometer", e.target.value)} />
        </Field>
        <Field label="Assign yard zone">
          <select
            value={f["yard_zone"] ?? ""}
            onChange={(e) => set("yard_zone", e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Parking</option>
            {ZONES.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Gate officer">
          <Input value={f["officer"] ?? ""} onChange={(e) => set("officer", e.target.value)} />
        </Field>
        <Field label="Vehicle condition">
          <Input value={f["vehicle_condition"] ?? ""} onChange={(e) => set("vehicle_condition", e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes">
            <Textarea value={f["notes"] ?? ""} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </div>
      </div>

      {expectedTrip ? (
        <p className="mt-3 rounded-md border border-primary/25 bg-primary/5 px-3 py-2 text-sm">
          Expected trip <strong>{expectedTrip.trip_number}</strong> — {expectedTrip.origin} to {expectedTrip.destination}
        </p>
      ) : f["vehicle_id"] ? (
        <p className="mt-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          No planned trip found for this vehicle.
        </p>
      ) : null}

      <Button className="mt-4 w-full sm:w-auto" onClick={() => save.mutate()} disabled={save.isPending}>
        Record gate in
      </Button>
    </Card>
  );
}

function GateOut({ data, onDone }: { data: any; onDone: () => void }) {
  const [f, setF] = useState<Record<string, string>>({});
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const trip = data?.trips.find((t: any) => t.id === f["trip_id"]);
  const load = data?.loads.find((l: any) => l.trip_id === f["trip_id"]);
  const inspection = data?.inspections
    .filter((i: any) => i.vehicle_id === trip?.vehicle_id)
    .sort((a: any, b: any) => String(b.inspected_at).localeCompare(String(a.inspected_at)))[0];
  const hold = data?.workOrders.some(
    (w: any) => w.vehicle_id === trip?.vehicle_id && !["Completed", "Released"].includes(w.status),
  );

  const save = useMutation({
    mutationFn: async () => {
      if (!trip) throw new Error("Choose a trip");
      const decision = f["decision"] || (hold || inspection?.result === "Fail" ? "Hold" : "Cleared");
      const { error } = await db.from("gate_entries").insert({
        direction: "Out",
        vehicle_id: trip.vehicle_id,
        driver_id: f["driver_id"] || trip.driver_id,
        trip_id: trip.id,
        event_time: new Date().toISOString(),
        odometer: f["odometer"] ? Number(f["odometer"]) : null,
        seal_verified: f["seal"] === load?.seal_number,
        fuel_verified: f["fuel_verified"] === "yes",
        inspection_verified: inspection?.result === "Pass",
        maintenance_hold: !!hold,
        decision,
        officer: f["officer"] || null,
        notes: f["notes"] || null,
        yard_zone: "Exit Gate",
      });
      if (error) throw error;

      if (hold) {
        await raiseException({
          exception_type: "Attempted Exit With Maintenance Hold",
          expected_value: "No open work order",
          actual_value: "Open work order on vehicle",
          vehicle_id: trip.vehicle_id,
          trip_id: trip.id,
          severity: "Critical",
        });
      }
      if (load?.seal_number && f["seal"] && f["seal"] !== load.seal_number) {
        await raiseException({
          exception_type: "Seal Mismatch",
          expected_value: load.seal_number,
          actual_value: f["seal"],
          vehicle_id: trip.vehicle_id,
          trip_id: trip.id,
          load_id: load.id,
          severity: "Critical",
        });
      }
      if (f["driver_id"] && trip.driver_id && f["driver_id"] !== trip.driver_id) {
        await raiseException({
          exception_type: "Wrong Driver At Gate",
          expected_value: data.drivers.find((d: any) => d.id === trip.driver_id)?.full_name ?? "—",
          actual_value: data.drivers.find((d: any) => d.id === f["driver_id"])?.full_name ?? "—",
          vehicle_id: trip.vehicle_id,
          trip_id: trip.id,
          severity: "High",
        });
      }
      if (inspection?.result === "Fail") {
        await raiseException({
          exception_type: "Vehicle Inspection Failure",
          expected_value: "Pass",
          actual_value: "Fail",
          vehicle_id: trip.vehicle_id,
          trip_id: trip.id,
          severity: "High",
        });
      }

      if (decision !== "Hold") {
        await db.from("vehicles").update({ status: "On Trip", yard_zone: null }).eq("id", trip.vehicle_id);
        await db.from("trips").update({ status: "Dispatched" }).eq("id", trip.id);
      } else {
        await db.from("vehicles").update({ status: "On Hold" }).eq("id", trip.vehicle_id);
      }
      await logAudit("gate_out", "gate_entries", trip.id, { decision });
      return decision;
    },
    onSuccess: (decision) => {
      toast[decision === "Hold" ? "error" : "success"](`Gate out: ${decision}`);
      setF({});
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openTrips = (data?.trips ?? []).filter((t: any) =>
    ["Approved", "Ready for Yard", "In Yard"].includes(t.status),
  );

  return (
    <Card className="p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Trip">
          <select
            value={f["trip_id"] ?? ""}
            onChange={(e) => set("trip_id", e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">—</option>
            {openTrips.map((t: any) => (
              <option key={t.id} value={t.id}>
                {t.trip_number} — {t.destination}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Driver leaving">
          <select
            value={f["driver_id"] ?? ""}
            onChange={(e) => set("driver_id", e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">—</option>
            {(data?.drivers ?? []).map((d: any) => (
              <option key={d.id} value={d.id}>
                {d.full_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Seal number on the truck">
          <Input value={f["seal"] ?? ""} onChange={(e) => set("seal", e.target.value)} />
        </Field>
        <Field label="Odometer">
          <Input type="number" value={f["odometer"] ?? ""} onChange={(e) => set("odometer", e.target.value)} />
        </Field>
        <Field label="Fuel matches allocation?">
          <select
            value={f["fuel_verified"] ?? ""}
            onChange={(e) => set("fuel_verified", e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">—</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </Field>
        <Field label="Gate decision">
          <select
            value={f["decision"] ?? ""}
            onChange={(e) => set("decision", e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Automatic</option>
            <option value="Cleared">Cleared</option>
            <option value="Cleared with Variance Approval">Cleared with variance approval</option>
            <option value="Hold">Hold</option>
          </select>
        </Field>
        <Field label="Gate officer">
          <Input value={f["officer"] ?? ""} onChange={(e) => set("officer", e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes">
            <Textarea value={f["notes"] ?? ""} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </div>
      </div>

      {trip ? (
        <div className="mt-3 space-y-2 text-sm">
          <p className="rounded-md border px-3 py-2">
            Expected load: <strong>{load?.load_reference ?? "none"}</strong> — qty {load?.expected_quantity ?? "—"}, seal{" "}
            {load?.seal_number ?? "—"}
          </p>
          <p
            className={
              "rounded-md border px-3 py-2 " +
              (hold ? "border-destructive/40 bg-destructive/5" : "border-primary/25 bg-primary/5")
            }
          >
            Maintenance hold: <strong>{hold ? "Yes — vehicle cannot leave" : "None"}</strong>
          </p>
          <p className="rounded-md border px-3 py-2">
            Last inspection: <strong>{inspection?.result ?? "none recorded"}</strong>
          </p>
        </div>
      ) : null}

      <Button className="mt-4 w-full sm:w-auto" onClick={() => save.mutate()} disabled={save.isPending}>
        Record gate out
      </Button>
    </Card>
  );
}
