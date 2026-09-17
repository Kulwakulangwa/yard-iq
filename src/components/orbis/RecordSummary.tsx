import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Pencil } from "lucide-react";

import { db } from "@/lib/db";
import { type ModuleConfig, type RefTable } from "@/lib/modules";
import { formatValue, humanize } from "@/lib/orbis";
import { tzs } from "@/lib/money";
import { useFxRate } from "@/lib/fx";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "./AppShell";
import { ConvoyLegRows, useConvoyLegs } from "./ConvoyRows";
import { ModuleStats } from "./ModuleStats";
import { StatusBadge } from "./StatusBadge";
import { TripSummaryCards } from "./TripSummaryCards";
import { useRecordEditor, useRefOptions, type Row } from "./RecordEditor";

function useRecord(config: ModuleConfig, recordId: string) {
  return useQuery({
    queryKey: [config.table, recordId],
    queryFn: async () => {
      const { data, error } = await db.from(config.table).select("*").eq("id", recordId).maybeSingle();
      if (error) throw error;
      return (data ?? null) as Row | null;
    },
  });
}

function TripSummary({ row, refs }: { row: Row; refs: Partial<Record<RefTable, { id: string; label: string }[]>> }) {
  const tripId = String(row["id"]);
  const fx = useFxRate();
  const { data: convoy } = useConvoyLegs();
  const legs = convoy?.get(tripId) ?? [];
  const { data = { finance: null as Row | null, expenses: [] as Row[], locations: [] as Row[] } } = useQuery({
    queryKey: ["trip-summary", tripId],
    queryFn: async () => {
      const [finance, expenses, locations] = await Promise.all([
        db.from("trip_financials").select("*").eq("trip_id", tripId).maybeSingle(),
        db.from("expenses").select("*").eq("trip_id", tripId).order("expense_date", { ascending: false }),
        db.from("trip_locations").select("*").eq("trip_id", tripId).order("reported_at", { ascending: false }),
      ]);
      if (finance.error) throw finance.error;
      if (expenses.error) throw expenses.error;
      if (locations.error) throw locations.error;
      return { finance: finance.data as Row | null, expenses: (expenses.data ?? []) as Row[], locations: (locations.data ?? []) as Row[] };
    },
  });
  const finance = data.finance;
  const expenseTotal = data.expenses.reduce((sum, expense) => sum + Number(expense["amount"] ?? 0), 0);
  const ref = (table: RefTable, id: unknown) => refs[table]?.find((item) => item.id === String(id))?.label ?? "—";

  return (
    <>
      <TripSummaryCards finance={finance} expenses={data.expenses} fx={fx} />

      <section className="mt-6">
        <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
          <div className="min-w-0">
            <h2 className="font-semibold">Convoy vehicles</h2>
            <p className="text-sm text-muted-foreground">Each vehicle, driver and latest tracker-officer location.</p>
          </div>
          <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            {legs.length > 1 ? `Convoy · ${legs.length} vehicles` : legs.length === 1 ? "Single vehicle" : "Not assigned"}
          </span>
        </div>
        <Card className="overflow-hidden">
          {legs.length === 0 ? (
            <div className="p-5 text-sm text-muted-foreground">No convoy vehicles assigned yet. Use Edit trip to add them.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead colSpan={4}>Vehicle movement lines</TableHead></TableRow></TableHeader>
                <TableBody><ConvoyLegRows legs={legs} colSpan={4} /></TableBody>
              </Table>
            </div>
          )}
        </Card>
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <Card className="overflow-hidden">
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold">Itemized expenses</h2>
            <p className="text-sm text-muted-foreground">Costs recorded against this trip.</p>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Category</TableHead><TableHead>Supplier</TableHead><TableHead>Vehicle</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.expenses.length === 0 ? <TableRow><TableCell colSpan={5}>No expenses logged.</TableCell></TableRow> : data.expenses.map((expense) => (
                  <TableRow key={String(expense["id"])}>
                    <TableCell className="font-medium">{formatValue(expense["category"])}</TableCell>
                    <TableCell>{formatValue(expense["supplier"])}</TableCell>
                    <TableCell>{ref("vehicles", expense["vehicle_id"])}</TableCell>
                    <TableCell className="whitespace-nowrap font-medium">{tzs(Number(expense["amount"] ?? 0))}</TableCell>
                    <TableCell><StatusBadge value={String(expense["status"] ?? "")} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end border-t bg-muted/30 px-4 py-3 text-sm"><span className="mr-8 text-muted-foreground">Total expenses</span><strong>{tzs(expenseTotal)}</strong></div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2"><MapPin className="size-4 text-primary" /><h2 className="font-semibold">Location history</h2></div>
          <div className="mt-4 space-y-4">
            {data.locations.length === 0 ? <p className="text-sm text-muted-foreground">No location reported yet.</p> : data.locations.slice(0, 8).map((location, index) => {
              const leg = legs.find((item) => item.id === String(location["trip_vehicle_id"]));
              return <div key={String(location["id"])} className="relative border-l pl-4 text-sm">
                <span className="absolute -left-1 top-1 size-2 rounded-full bg-primary" />
                <p className="font-medium">{formatValue(location["location"])}</p>
                <p className="text-muted-foreground">{leg?.vehicle ?? (index === 0 ? "Whole trip" : "Trip update")}{location["checkpoint"] ? ` · ${location["checkpoint"]}` : ""}</p>
                <p className="text-xs text-muted-foreground">{formatValue(location["reported_at"])}{location["reported_by"] ? ` · ${location["reported_by"]}` : ""}</p>
              </div>;
            })}
          </div>
        </Card>
      </section>
    </>
  );
}

export function RecordSummary({ config, recordId, slug }: { config: ModuleConfig; recordId: string; slug: string }) {
  const { data: row, isLoading, error } = useRecord(config, recordId);
  const { data: refs = {} } = useRefOptions(config.fields);
  const editor = useRecordEditor(config, row ? [row] : []);
  const titleKey = config.prefixKey ?? config.columns[0] ?? "id";
  const refLabel = (table: RefTable | undefined, id: unknown) => table && id ? refs[table]?.find((o) => o.id === String(id))?.label ?? "—" : "—";
  const summaryFields = useMemo(() => config.fields.filter((field) => !field.readOnly || field.key === titleKey), [config.fields, titleKey]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading summary…</p>;
  if (error || !row) return <Card className="p-8 text-center"><h1 className="font-semibold">Record not found</h1><Button asChild variant="link"><Link to="/m/$slug" params={{ slug }}>Back to {config.title.toLowerCase()}</Link></Button></Card>;

  const route = row["origin"] && row["destination"] ? `${row["origin"]} → ${row["destination"]}` : config.subtitle;
  return (
    <>
      <Link to="/m/$slug" params={{ slug }} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> All {config.title.toLowerCase()}</Link>
      <PageHeader
        title={String(row[titleKey] ?? config.title.replace(/s$/, ""))}
        subtitle={String(route)}
        actions={<Button onClick={() => editor.openEdit(row)}><Pencil className="size-4" /> Edit {config.table === "trips" ? "trip" : "record"}</Button>}
      />
      {editor.dialog}
      {config.statusKey ? <div className="mb-4"><StatusBadge value={String(row[config.statusKey] ?? "")} /></div> : null}

      {config.table === "trips" ? <TripSummary row={row} refs={refs} /> : (
        <>
          <ModuleStats table={config.table} rows={[row]} />
          <Card className="overflow-hidden">
            <div className="border-b px-4 py-3"><h2 className="font-semibold">Record summary</h2><p className="text-sm text-muted-foreground">Complete operational information for this record.</p></div>
            <dl className="grid sm:grid-cols-2 xl:grid-cols-3">
              {summaryFields.map((field) => (
                <div key={field.key} className="min-w-0 border-b p-4 sm:border-r">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">{field.label ?? humanize(field.key)}</dt>
                  <dd className="mt-1 break-words text-sm font-medium">{field.type === "ref" ? refLabel(field.refTable, row[field.key]) : field.key === config.statusKey ? <StatusBadge value={String(row[field.key] ?? "")} /> : formatValue(row[field.key])}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </>
      )}
    </>
  );
}
