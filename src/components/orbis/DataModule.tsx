import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Plus } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { REF_LABEL, type Field, type ModuleConfig, type RefTable } from "@/lib/modules";
import { exportCsv, formatValue, humanize, logAudit, nextReference } from "@/lib/orbis";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "./AppShell";
import { StatusBadge } from "./StatusBadge";

type Row = Record<string, unknown>;
const db = supabase as never as {
  from: (t: string) => any;
};

export function useRows(table: string) {
  return useQuery({
    queryKey: [table],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await db.from(table).select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
}

function useRefOptions(fields: Field[]) {
  const tables = [...new Set(fields.filter((f) => f.refTable).map((f) => f.refTable as RefTable))];
  return useQuery({
    queryKey: ["refs", tables.join(",")],
    enabled: tables.length > 0,
    queryFn: async () => {
      const out: Partial<Record<RefTable, { id: string; label: string }[]>> = {};
      for (const t of tables) {
        const { data } = await db.from(t).select(`id, ${REF_LABEL[t]}`).limit(500);
        out[t] = ((data ?? []) as Row[]).map((r) => ({
          id: String(r["id"]),
          label: String(r[REF_LABEL[t]] ?? r["id"]),
        }));
      }
      return out;
    },
  });
}

export function DataModule({
  config,
  readOnlyNotice,
}: {
  config: ModuleConfig;
  readOnlyNotice?: string;
}) {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useRows(config.table);
  const { data: refs = {} } = useRefOptions(config.fields);
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Row>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  const refLabel = (table: RefTable | undefined, id: unknown) => {
    if (!table || !id) return "—";
    return refs[table]?.find((o) => o.id === String(id))?.label ?? "—";
  };

  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) => config.searchKeys.some((k) => String(r[k] ?? "").toLowerCase().includes(t)));
  }, [rows, term, config.searchKeys]);

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
      qc.invalidateQueries({ queryKey: [config.table] });
      setOpen(false);
      toast.success(editingId ? "Record updated" : "Record created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openNew() {
    setEditingId(null);
    setDraft({});
    setOpen(true);
  }

  function openEdit(row: Row) {
    setEditingId(String(row["id"]));
    const d: Row = {};
    for (const f of config.fields) d[f.key] = row[f.key] ?? "";
    setDraft(d);
    setOpen(true);
  }

  return (
    <>
      <PageHeader
        title={config.title}
        subtitle={config.subtitle}
        actions={
          <>
            <Button variant="outline" onClick={() => exportCsv(config.table, filtered, config.columns)}>
              <Download className="mr-1.5 size-4" /> Export
            </Button>
            <Button onClick={openNew}>
              <Plus className="mr-1.5 size-4" /> New
            </Button>
          </>
        }
      />

      {readOnlyNotice ? (
        <p className="mb-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          {readOnlyNotice}
        </p>
      ) : null}

      <Card className="p-3 sm:p-4">
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={`Search ${config.title.toLowerCase()}…`}
          className="mb-3 sm:max-w-sm"
        />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {config.columns.map((c) => (
                  <TableHead key={c} className="whitespace-nowrap">
                    {humanize(c)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={config.columns.length}>Loading…</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={config.columns.length}>No records yet.</TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => (
                  <TableRow
                    key={String(row["id"])}
                    onClick={() => openEdit(row)}
                    className="cursor-pointer"
                  >
                    {config.columns.map((c) => {
                      const field = config.fields.find((f) => f.key === c);
                      return (
                        <TableCell key={c} className="whitespace-nowrap">
                          {c === config.statusKey ? (
                            <StatusBadge value={row[c] ? String(row[c]) : null} />
                          ) : field?.type === "ref" ? (
                            refLabel(field.refTable, row[c])
                          ) : (
                            formatValue(row[c])
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit" : "New"} {config.title.replace(/s$/, "")}
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
                      {(refs[f.refTable as RefTable] ?? []).map((o) => (
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
    </>
  );
}
