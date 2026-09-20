import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { db } from "@/lib/db";
import { REF_LABEL, type Field, type ModuleConfig, type RefTable } from "@/lib/modules";
import { humanize, logAudit, nextReference } from "@/lib/orbis";
import { useAvailability } from "@/lib/availability";
import { useRelatedIndex } from "@/lib/relatedIndex";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TripFinance } from "./TripFinance";
import { TripConvoy } from "./TripConvoy";
import { TripLocationLog } from "./TripLocationLog";

export type Row = Record<string, unknown>;

type RefOption = { id: string; label: string; [k: string]: unknown };

export function useRefOptions(fields: Field[]) {
  const tables = [...new Set(fields.filter((f) => f.refTable).map((f) => f.refTable as RefTable))];

  const extraColumns: Record<string, string[]> = {};
  for (const f of fields) {
    if (!f.refTable || !f.refFilter) continue;
    const set = new Set(extraColumns[f.refTable] ?? []);
    set.add(f.refFilter.key);
    extraColumns[f.refTable] = [...set];
  }

  const filterKey = JSON.stringify(
    Object.fromEntries(
      Object.entries(extraColumns).map(([k, v]) => [k, [...v].sort()]),
    ),
  );

  return useQuery({
    queryKey: ["refs", tables.join(","), filterKey],
    enabled: tables.length > 0,
    queryFn: async () => {
      const out: Partial<Record<RefTable, RefOption[]>> = {};
      for (const t of tables) {
        const extras = extraColumns[t] ?? [];
        const cols = ["id", REF_LABEL[t], ...extras].join(", ");
        const { data } = await db.from(t).select(cols).limit(500);
        out[t] = ((data ?? []) as Row[]).map((r) => {
          const entry: RefOption = {
            id: String(r["id"]),
            label: String(r[REF_LABEL[t]] ?? r["id"]),
          };
          for (const e of extras) entry[e] = r[e];
          return entry;
        });
      }
      return out;
    },
  });
}

export function useRecordEditor(config: ModuleConfig, rows: Row[] = []) {
  const qc = useQueryClient();
  const { data: refs = {} } = useRefOptions(config.fields);
  const relatedIndex = useRelatedIndex();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Row>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  // Field keys whose "Show all" toggle is on (unlocks unrelated options)
  const [showAllFields, setShowAllFields] = useState<Set<string>>(new Set());

  const needsAvailability =
    config.table === "trips" ||
    config.table === "fuel_allocations" ||
    config.table === "vehicle_maintenance" ||
    config.table === "work_orders" ||
    config.table === "loads";

  const availability = useAvailability({
    excludeTripId: config.table === "trips" && editingId ? editingId : undefined,
  });

  const save = useMutation({
    mutationFn: async (payload: Row) => {
      const body = { ...payload };
      for (const key of Object.keys(body)) if (body[key] === "") body[key] = null;
      if (editingId) {
        const { error } = await db.from(config.table).update(body).eq("id", editingId);
        if (error) throw error;
        await logAudit("update", config.table, editingId, body);
      } else {
        if (config.prefix && config.prefixKey) {
          body[config.prefixKey] = nextReference(
            config.prefix,
            rows.map((r) => String(r[config.prefixKey!] ?? "")),
          );
        }
        const { data, error } = await db.from(config.table).insert(body).select("id").single();
        if (error) throw error;
        await logAudit("create", config.table, data?.id, body);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries();
      setOpen(false);
      toast.success(editingId ? "Record updated" : "Record created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openNew(defaults: Row = {}) {
    const isEvent =
      defaults &&
      typeof defaults === "object" &&
      ("nativeEvent" in defaults || "currentTarget" in defaults);
    const safeDefaults: Row = isEvent ? {} : defaults;
    setEditingId(null);
    setDraft(safeDefaults);
    setShowAllFields(new Set());
    setOpen(true);
  }

  function openEdit(row: Row) {
    setEditingId(String(row["id"]));
    const d: Row = {};
    for (const f of config.fields) d[f.key] = row[f.key] ?? "";
    setDraft(d);
    setShowAllFields(new Set());
    setOpen(true);
  }

  const refLabel = (table: RefTable | undefined, id: unknown) => {
    if (!table || !id) return "—";
    return refs[table]?.find((o) => o.id === String(id))?.label ?? "—";
  };

  /** Reasons a busy option is blocked (hard block, never overridable). */
  function busyReason(f: Field, optionId: string): string | null {
    if (!needsAvailability) return null;
    if (f.refTable === "drivers") {
      if (availability.busyDriverIds.has(optionId)) {
        const trip = availability.busyReasonByDriverId.get(optionId);
        return trip ? `On ${trip}` : "Busy";
      }
      return null;
    }
    if (f.refTable === "vehicles") {
      const isTrailer = f.refFilter?.value === true;
      if (isTrailer && availability.busyTrailerIds.has(optionId)) {
        return availability.busyReasonByVehicleId.get(optionId) ?? "Busy";
      }
      if (!isTrailer && availability.busyTruckIds.has(optionId)) {
        return availability.busyReasonByVehicleId.get(optionId) ?? "Busy";
      }
      return null;
    }
    return null;
  }

  /**
   * Compute which options are unrelated to the current pivot for a given field.
   * Returns null when the rule doesn't apply (no rule, no pivot, no data).
   */
  function unrelatedSet(f: Field): Set<string> | null {
    if (!f.refRule) return null;
    const pivotValue = draft[f.refRule.by];
    if (!pivotValue || pivotValue === "") return null;
    const map = relatedIndex[f.refRule.resolve];
    if (!map) return null;
    const set = map.get(String(pivotValue));
    if (!set || set.size === 0) return null;
    return set;
  }

  function setField(f: Field, value: unknown) {
    // Pre-compute autoFill candidates outside setDraft (cleaner, no stale closures).
    const autoFill: Record<string, unknown> = {};
    for (const other of config.fields) {
      if (!other.refRule || other.refRule.by !== f.key) continue;
      if (!other.refRule.autoFill) continue;
      if (!value || value === "") {
        autoFill[other.key] = "";
        continue;
      }
      const map = relatedIndex[other.refRule.resolve];
      const set = map?.get(String(value));
      if (!set || set.size === 0) continue;
      const opts = refs[other.refTable as RefTable] ?? [];
      const firstMatch = opts.find((o) => set.has(o.id));
      if (firstMatch) autoFill[other.key] = firstMatch.id;
    }

    setDraft((d) => {
      const next: Row = { ...d, [f.key]: value };

      // Apply refRule autoFill — only when the target is currently empty
      for (const [k, v] of Object.entries(autoFill)) {
        const current = next[k];
        const isEmpty = current === undefined || current === null || current === "";
        if (isEmpty || v === "") next[k] = v;
      }

      // Trip-specific cascades (driver → truck → coupled trailer)
      if (config.table === "trips") {
        if (f.key === "driver_id" && typeof value === "string") {
          const assignedTruck = availability.truckByDriver.get(value);
          if (
            assignedTruck &&
            !availability.busyTruckIds.has(assignedTruck) &&
            (next["vehicle_id"] === "" || next["vehicle_id"] === null || next["vehicle_id"] === undefined)
          ) {
            next["vehicle_id"] = assignedTruck;
            const coupledTrailer = availability.trailerByTruck.get(assignedTruck);
            if (
              coupledTrailer &&
              !availability.busyTrailerIds.has(coupledTrailer) &&
              (next["trailer_id"] === "" || next["trailer_id"] === null || next["trailer_id"] === undefined)
            ) {
              next["trailer_id"] = coupledTrailer;
            }
          }
        }
        if (f.key === "vehicle_id" && typeof value === "string") {
          const coupledTrailer = availability.trailerByTruck.get(value);
          if (coupledTrailer && !availability.busyTrailerIds.has(coupledTrailer)) {
            next["trailer_id"] = coupledTrailer;
          }
        }
      }

      return next;
    });
  }

  const dialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {editingId ? "Edit" : "New"}{" "}
            {config.table === "vehicles" && Boolean(draft["is_trailer"])
              ? "Trailer"
              : config.title.replace(/s$/, "")}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          {config.fields.map((f) => {
            const label = f.label ?? humanize(f.key);
            const value = draft[f.key];
            const id = `f-${f.key}`;
            const wide = f.type === "textarea";
            const showAll = showAllFields.has(f.key);

            // Base options (before rule)
            const baseOptions = (refs[f.refTable as RefTable] ?? []).filter((o) => {
              if (!f.refFilter) return true;
              return o[f.refFilter.key] === f.refFilter.value;
            });

            // refRule context
            const relevantSet = unrelatedSet(f);
            const irrelevantCount = relevantSet
              ? baseOptions.filter((o) => !relevantSet.has(o.id)).length
              : 0;

            return (
              <div key={f.key} className={wide ? "sm:col-span-2" : undefined}>
                <Label htmlFor={id} className="mb-1.5 block text-xs text-muted-foreground">
                  {label}
                </Label>
                {f.type === "textarea" ? (
                  <Textarea
                    id={id}
                    value={String(value ?? "")}
                    onChange={(e) => setField(f, e.target.value)}
                  />
                ) : f.type === "boolean" ? (
                  <Switch
                    id={id}
                    checked={Boolean(value)}
                    onCheckedChange={(v) => setField(f, v)}
                  />
                ) : f.type === "select" ? (
                  <select
                    id={id}
                    value={String(value ?? "")}
                    onChange={(e) => setField(f, e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">—</option>
                    {(f.options ?? []).filter(Boolean).map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : f.type === "ref" ? (
                  <>
                    <select
                      id={id}
                      value={String(value ?? "")}
                      onChange={(e) => setField(f, e.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">—</option>
                      {baseOptions.map((o) => {
                        const isSelected = String(value ?? "") === o.id;
                        const busy = busyReason(f, o.id);
                        const unrelated = relevantSet ? !relevantSet.has(o.id) : false;
                        const disabled =
                          (!isSelected && Boolean(busy)) ||
                          (!isSelected && unrelated && !showAll);
                        const hint = busy
                          ? ` · ${busy}`
                          : unrelated && !showAll
                            ? " · unrelated"
                            : "";
                        return (
                          <option key={o.id} value={o.id} disabled={disabled}>
                            {o.label}
                            {hint}
                          </option>
                        );
                      })}
                    </select>
                    {irrelevantCount > 0 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setShowAllFields((prev) => {
                            const next = new Set(prev);
                            if (next.has(f.key)) next.delete(f.key);
                            else next.add(f.key);
                            return next;
                          })
                        }
                        className="mt-1 text-xs text-primary hover:underline"
                      >
                        {showAll
                          ? `Hide ${irrelevantCount} unrelated option${irrelevantCount === 1 ? "" : "s"}`
                          : `Show ${irrelevantCount} unrelated option${irrelevantCount === 1 ? "" : "s"}`}
                      </button>
                    ) : null}
                  </>
                ) : (
                  <Input
                    id={id}
                    type={
                      f.type === "number"
                        ? "number"
                        : f.type === "date"
                          ? "date"
                          : f.type === "datetime"
                            ? "datetime-local"
                            : "text"
                    }
                    value={String(value ?? "").slice(0, f.type === "datetime" ? 16 : undefined)}
                    readOnly={f.readOnly === true}
                    onChange={(e) =>
                      setField(
                        f,
                        f.type === "number"
                          ? e.target.value === ""
                            ? ""
                            : Number(e.target.value)
                          : e.target.value,
                      )
                    }
                  />
                )}
              </div>
            );
          })}
        </div>

        {config.table === "trips" && editingId ? (
          <>
            <TripConvoy tripId={editingId} />
            <TripFinance tripId={editingId} />
            <TripLocationLog tripId={editingId} />
          </>
        ) : config.table === "trips" ? (
          <p className="text-sm text-muted-foreground">
            Save the trip first to add its finances, trucks and location updates.
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate(draft)} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { dialog, openNew, openEdit, refLabel, refs };
}
