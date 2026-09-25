import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Download, Eye, FileText, MoreHorizontal, Pencil, Plus, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { db } from "@/lib/db";
import { modules, type ModuleConfig } from "@/lib/modules";
import { exportCsv, formatValue, humanize, logAudit } from "@/lib/orbis";
import { syncTrucksForTrip } from "@/lib/tripStatusSync";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "./AppShell";
import { StatusBadge } from "./StatusBadge";
import { ModuleStats } from "./ModuleStats";
import { ConvoyLegRows, useConvoyLegs } from "./ConvoyRows";
import { useRecordEditor } from "./RecordEditor";

type Row = Record<string, unknown>;

// ───────────────────────────────────────────────────────────────
// Direction colouring (trips only)
// ───────────────────────────────────────────────────────────────
const DIRECTION_ROW_BORDER: Record<string, string> = {
  Outbound: "border-l-blue-500",
  Return: "border-l-amber-500",
};

const DIRECTION_PILL: Record<string, string> = {
  Outbound: "border-blue-500/40 bg-blue-500/10 text-blue-400",
  Return: "border-amber-500/40 bg-amber-500/10 text-amber-400",
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

export function DataModule({
  config,
  readOnlyNotice,
}: {
  config: ModuleConfig;
  readOnlyNotice?: string;
}) {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useRows(config.table);
  const { dialog, openNew, openEdit, refLabel, refs } = useRecordEditor(config, rows);
  const [term, setTerm] = useState("");
  const [tab, setTab] = useState("All");
  const slug = Object.entries(modules).find(([, module]) => module.table === config.table)?.[0];

  const isTrips = config.table === "trips";
  const { data: convoy } = useConvoyLegs();

  const statusOrder = useMemo(() => {
    if (!config.statusKey) return [] as string[];
    const field = config.fields.find((f) => f.key === config.statusKey);
    const opts = (config.statusOptions ?? field?.options ?? []).filter(Boolean);
    return opts;
  }, [config.statusKey, config.statusOptions, config.fields]);

  const setStatus = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: string }) => {
      const { error } = await db
        .from(config.table)
        .update({ [config.statusKey as string]: value })
        .eq("id", id);
      if (error) throw error;
      if (config.table === "trips") {
        await syncTrucksForTrip(id, value);
      }
      await logAudit("update", config.table, id, { [config.statusKey as string]: value });
    },
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Status updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const tabs = useMemo(() => {
    if (!config.statusKey) return [];
    const present = new Set(rows.map((r) => String(r[config.statusKey!] ?? "")).filter(Boolean));
    const ordered = statusOrder.filter((o) => present.has(o));
    const extras = [...present].filter((p) => !ordered.includes(p));
    const values = ordered.length > 0 ? [...ordered, ...extras] : [...present];
    return values.map((v) => ({
      value: v,
      count: rows.filter((r) => String(r[config.statusKey!] ?? "") === v).length,
    }));
  }, [rows, config.statusKey, statusOrder]);

  // ─── Search matches raw fields + resolved labels of any `ref` field ───
  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase();
    let list = rows;
    if (tab !== "All" && config.statusKey) {
      list = list.filter((r) => String(r[config.statusKey!] ?? "") === tab);
    }
    if (t) {
      list = list.filter((r) => {
        // 1. Direct fields listed in searchKeys
        if (config.searchKeys.some((k) => String(r[k] ?? "").toLowerCase().includes(t))) {
          return true;
        }
        // 2. Any ref field — resolve the id to its display label and search that
        for (const f of config.fields) {
          if (f.type !== "ref" || !f.refTable) continue;
          const id = r[f.key];
          if (!id) continue;
          const label = refs[f.refTable]?.find((o) => o.id === String(id))?.label;
          if (label && label.toLowerCase().includes(t)) return true;
        }
        return false;
      });
    }
    return list;
  }, [rows, term, tab, config.searchKeys, config.statusKey, config.fields, refs]);

  const colSpan = config.columns.length + 1;

  const placeholder = isTrips
    ? "Search trip, customer, driver, vehicle…"
    : `Search ${config.title.toLowerCase()}…`;

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
            <Button onClick={() => openNew()}>
              <Plus className="mr-1.5 size-4" /> New
            </Button>
          </>
        }
      />

      {readOnlyNotice ? (
        <p className="mb-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">{readOnlyNotice}</p>
      ) : null}

      <ModuleStats table={config.table} rows={rows} />

      <Card className="w-full p-3 sm:p-4">
        <div className="mb-3 grid grid-cols-[minmax(0,1fr)] gap-3 lg:flex lg:items-center lg:justify-between">
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={placeholder}
            className="min-w-0 lg:max-w-sm"
          />
          {tabs.length > 0 ? (
            <div className="-mx-1 flex gap-1 overflow-x-auto px-1">
              {[{ value: "All", count: rows.length }, ...tabs].map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTab(t.value)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-sm transition-colors ${
                    tab === t.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {t.value === "All" ? "All" : humanize(t.value)}
                  <span className="ml-1.5 text-xs opacity-70">{t.count}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {config.columns.map((c) => (
                  <TableHead key={c} className="whitespace-nowrap">
                    {humanize(c)}
                  </TableHead>
                ))}
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={colSpan}>Loading…</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={colSpan}>No records yet.</TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => {
                  const id = String(row["id"]);
                  const legs = isTrips ? (convoy?.get(id) ?? []) : [];
                  const currentStatus = config.statusKey ? String(row[config.statusKey] ?? "") : "";
                  const currentIdx = statusOrder.indexOf(currentStatus);
                  const nextStatus =
                    currentIdx >= 0 && currentIdx < statusOrder.length - 1
                      ? statusOrder[currentIdx + 1]
                      : null;

                  // Direction (trips only)
                  const direction = isTrips ? String(row["direction"] ?? "Outbound") : "";
                  const rowBorderClass =
                    isTrips && DIRECTION_ROW_BORDER[direction]
                      ? `border-l-4 ${DIRECTION_ROW_BORDER[direction]}`
                      : "";

                  return (
                    <React.Fragment key={id}>
                      <TableRow className={cn("cursor-pointer", rowBorderClass)}>
                        {config.columns.map((c) => {
                          const field = config.fields.find((f) => f.key === c);

                          // Special trip-number cell: trip code + direction pill + truck count
                          if (isTrips && c === config.columns[0]) {
                            return (
                              <TableCell key={c} className="whitespace-nowrap align-top">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-medium">{String(row[c] ?? "")}</span>
                                  {direction ? (
                                    <span
                                      className={cn(
                                        "rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                        DIRECTION_PILL[direction] ?? "",
                                      )}
                                    >
                                      {direction}
                                    </span>
                                  ) : null}
                                  {legs.length > 0 ? (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                                      <Users className="size-3" />{" "}
                                      {legs.length === 1 ? "1 truck" : `${legs.length} trucks`}
                                    </span>
                                  ) : null}
                                </div>
                              </TableCell>
                            );
                          }

                          return (
                            <TableCell key={c} className="whitespace-nowrap align-top">
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
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label="Row actions">
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {slug ? (
                                <DropdownMenuItem asChild>
                                  <Link to="/m/$slug/$recordId" params={{ slug, recordId: id }}>
                                    <Eye className="mr-2 size-4" /> View details
                                  </Link>
                                </DropdownMenuItem>
                              ) : null}
                              {isTrips && slug ? (
                                <DropdownMenuItem asChild>
                                  <Link to="/m/$slug/$recordId" params={{ slug, recordId: id }} hash="trip-audit">
                                    <FileText className="mr-2 size-4" /> Open audit
                                  </Link>
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuItem onClick={() => openEdit(row)}>
                                <Pencil className="mr-2 size-4" /> Edit {isTrips ? "trip" : ""}
                              </DropdownMenuItem>
                              {nextStatus ? (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => setStatus.mutate({ id, value: nextStatus })}>
                                    <Check className="mr-2 size-4" /> Move to {nextStatus}
                                  </DropdownMenuItem>
                                </>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                      {isTrips && legs.length > 0 ? (
                        <ConvoyLegRows legs={legs} colSpan={colSpan} />
                      ) : null}
                    </React.Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {dialog}
    </>
  );
}
