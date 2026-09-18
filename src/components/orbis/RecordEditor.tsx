import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { db } from "@/lib/db";
import { REF_LABEL, type Field, type ModuleConfig, type RefTable } from "@/lib/modules";
import { humanize, logAudit, nextReference } from "@/lib/orbis";
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

  // Collect extra columns per table (from any field's refFilter key)
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

/**
 * Shared add/edit dialog for any module config. Returns the dialog element plus
 * handlers, so summary pages can reuse the same form as the generic tables.
 */
export function useRecordEditor(config: ModuleConfig, rows: Row[] = []) {
  const qc = useQueryClient();
  const { data: refs = {} } = useRefOptions(config.fields);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Row>({});
  const [editingId, setEditingId] = useState<string | null>(null);

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
    setEditingId(null);
    setDraft(defaults);
    setOpen(true);
  }

  function openEdit(row: Row) {
    setEditingId(String(row["id"]));
    const d: Row = {};
    for (const f of config.fields) d[f.key] = row[f.key] ?? "";
    setDraft(d);
    setOpen(true);
  }

  const refLabel = (table: RefTable | undefined, id: unknown) => {
    if (!table || !id) return "—";
    return refs[table]?.find((o) => o.id === String(id))?.label ?? "—";
  };

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
            const set = (v: unknown) => setDraft((d) => ({ ...d, [f.key]: v }));
            const id = `f-${f.key}`;
            const wide = f.type === "textarea";
            return (
              <div key={f.key} className={wide ? "sm:col-span-2" : undefined}>
                <Label htmlFor={id} className="mb-1.5 block text-xs text-muted-foreground">
                  {label}
                </Label>
                {f.type === "textarea" ? (
                  <Textarea id={id} value={String(value ?? "")} onChange={(e) => set(e.target.value)} />
                ) : f.type === "boolean" ? (
                  <Switch id={id} checked={Boolean(value)} onCheckedChange={set} />
                ) : f.type === "select" ? (
                  <select
                    id={id}
                    value={String(value ?? "")}
                    onChange={(e) => set(e.target.value)}
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
                  <select
                    id={id}
                    value={String(value ?? "")}
                    onChange={(e) => set(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">—</option>
                    {(refs[f.refTable as RefTable] ?? [])
                      .filter((o) => {
                        if (!f.refFilter) return true;
                        return o[f.refFilter.key] === f.refFilter.value;
                      })
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                  </select>
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
                      set(f.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)
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
