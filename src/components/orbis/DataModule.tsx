import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Eye, MoreHorizontal, Pencil, Plus, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { db } from "@/lib/db";
import { modules, type ModuleConfig } from "@/lib/modules";
import { exportCsv, formatValue, humanize, logAudit } from "@/lib/orbis";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
  const { dialog, openNew, openEdit, refLabel } = useRecordEditor(config, rows);
  const [term, setTerm] = useState("");
  const [tab, setTab] = useState("All");
  const slug = Object.entries(modules).find(([, module]) => module.table === config.table)?.[0];

  const isTrips = config.table === "trips";
  const { data: convoy } = useConvoyLegs();

  const setStatus = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: string }) => {
      const { error } = await db
        .from(config.table)
        .update({ [config.statusKey as string]: value })
        .eq("id", id);
      if (error) throw error;
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
    const ordered = (config.statusOptions ?? []).filter((o) => present.has(o));
    const extras = [...present].filter((p) => !ordered.includes(p));
    const values = ordered.length > 0 ? [...ordered, ...extras] : [...present];
    return values.map((v) => ({
      value: v,
      count: rows.filter((r) => String(r[config.statusKey!] ?? "") === v).length,
    }));
  }, [rows, config.statusKey, config.statusOptions]);

  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase();
    let list = rows;
    if (tab !== "All" && config.statusKey) {
      list = list.filter((r) => String(r[config.statusKey!] ?? "") === tab);
    }
    if (t) {
      list = list.filter((r) => config.searchKeys.some((k) => String(r[k] ?? "").toLowerCase().includes(t)));
    }
    return list;
  }, [rows, term, tab, config.searchKeys, config.statusKey]);

  const colSpan = config.columns.length + 1;

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
        <p className="mb-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">{readOnlyNotice}</p>
      ) : null}

      <ModuleStats table={config.table} rows={rows} />

      <Card className="w-full p-3 sm:p-4">
        <div className="mb-3 grid grid-cols-[minmax(0,1fr)] gap-3 lg:flex lg:items-center lg:justify-between">
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={`Search ${config.title.toLowerCase()}…`}
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
                  return (
                    <React.Fragment key={id}>
                      <TableRow className="cursor-pointer">

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
                              {isTrips && c === config.columns[0] && legs.length > 1 ? (
                                <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-primary/40 px-2 py-0.5 text-[11px] text-primary">
                                  <Users className="size-3" /> Convoy · {legs.length}
                                </span>
                              ) : null}
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
                                    <Eye className="mr-2 size-4" /> View summary
                                  </Link>
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuItem onClick={() => openEdit(row)}>
                                <Pencil className="mr-2 size-4" /> Edit
                              </DropdownMenuItem>
                              {config.statusKey && (config.statusOptions ?? []).length > 0 ? (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                                    Move to
                                  </DropdownMenuLabel>
                                  {(config.statusOptions ?? [])
                                    .filter((o) => o && o !== String(row[config.statusKey!] ?? ""))
                                    .map((o) => (
                                      <DropdownMenuItem key={o} onClick={() => setStatus.mutate({ id, value: o })}>
                                        {o}
                                      </DropdownMenuItem>
                                    ))}
                                </>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                      {legs.length > 1 ? <ConvoyLegRows legs={legs} colSpan={colSpan} /> : null}
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
