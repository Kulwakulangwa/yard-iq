import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Pencil, Plus } from "lucide-react";

import { db } from "@/lib/db";
import { modules, type Field, type ModuleConfig, type RefTable } from "@/lib/modules";
import { formatValue, humanize } from "@/lib/orbis";
import { dualDisplay } from "@/lib/money";
import { useFxRate } from "@/lib/fx";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "./AppShell";
import { ConvoyLegList, useConvoyLegs } from "./ConvoyRows";
import { ModuleStats } from "./ModuleStats";
import { StatusBadge } from "./StatusBadge";
import { TripHeader } from "./TripHeader";
import { TripSummaryCards } from "./TripSummaryCards";
import { TripExpensesTable } from "./TripExpensesTable";
import { TripFuelSection } from "./TripFuelSection";
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

const CHOSEN_CURRENCY_KEYS = new Set([
  "amount",
  "tax",
  "fuel_cost",
  "contract_amount",
  "cost",
]);

function moneyMode(key: string, row: Row): "chosen" | "tzs" | null {
  if (CHOSEN_CURRENCY_KEYS.has(key) && ("currency" in row || "contract_currency" in row)) {
    return "chosen";
  }
  if (key.endsWith("_tzs")) return "tzs";
  return null;
}

function MoneyValue({ amount, currency, fx }: { amount: number; currency: string; fx: number }) {
  const display = dualDisplay(amount, currency, fx);
  return (
    <div className="leading-tight">
      <div className="font-medium">{display.primary}</div>
      <div className="text-xs font-normal text-muted-foreground">{display.secondary}</div>
    </div>
  );
}

function FieldValue({
  field,
  row,
  config,
  fx,
  refLabel,
}: {
  field: Field;
  row: Row;
  config: ModuleConfig;
  fx: number;
  refLabel: (table: RefTable | undefined, id: unknown) => string;
}) {
  if (field.type === "ref") return <>{refLabel(field.refTable, row[field.key])}</>;
  if (field.key === config.statusKey) return <StatusBadge value={String(row[field.key] ?? "")} />;

  const mode = moneyMode(field.key, row);
  if (mode && field.type === "number") {
    const amount = Number(row[field.key] ?? 0);
    const currency =
      mode === "tzs"
        ? "TZS"
        : String(row["currency"] ?? row["contract_currency"] ?? "TZS");
    return <MoneyValue amount={amount} currency={currency} fx={fx} />;
  }

  return <>{formatValue(row[field.key])}</>;
}

function TripSummary({
  row,
  refs,
  tripEditor,
}: {
  row: Row;
  refs: Partial<Record<RefTable, { id: string; label: string }[]>>;
  tripEditor: ReturnType<typeof useRecordEditor>;
}) {
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

  const { data: allExpenses = [] } = useQuery({
    queryKey: ["expenses-numbers"],
    queryFn: async () => {
      const { data } = await db.from("expenses").select("id, expense_number");
      return (data ?? []) as Row[];
    },
  });
  const expenseEditor = useRecordEditor(modules.expenses, allExpenses);

  function handleAddExpense() {
    expenseEditor.openNew({
      trip_id: tripId,
      expense_date: new Date().toISOString().slice(0, 10),
      currency: "TZS",
    });
  }

  return (
    <>
      <TripHeader
        row={row}
        refs={refs}
        actions={
          <>
            <Button variant="outline" onClick={() => tripEditor.openEdit(row)}>
              <Pencil className="size-4" /> Edit trip
            </Button>
            <Button onClick={handleAddExpense}>
              <Plus className="size-4" /> Add expense
            </Button>
          </>
        }
      />

      <TripSummaryCards finance={finance} expenses={data.expenses} fx={fx} />

      {/* ─── Trucks on this trip ─────────────────────────── */}
      <section className="mt-6">
        <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
          <div className="min-w-0">
            <h2 className="font-semibold">Trucks on this trip</h2>
            <p className="text-sm text-muted-foreground">
              Every truck on this trip, with its own driver, trailer and latest location.
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            {legs.length === 0
              ? "None assigned"
              : legs.length === 1
                ? "1 truck"
                : `${legs.length} trucks`}
          </span>
        </div>
        <Card className="overflow-hidden">
          <ConvoyLegList legs={legs} />
        </Card>
      </section>

      {/* ─── Fuel purchases ──────────────────────────────── */}
      <section className="mt-6">
        <TripFuelSection tripId={tripId} />
      </section>

      {/* ─── Expenses + Location history ─────────────────── */}
      <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <Card id="trip-audit" className="overflow-hidden scroll-mt-20">
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold">Itemized expenses</h2>
            <p className="text-sm text-muted-foreground">
              Filter by category, review receipts, and audit the driver cash-flow.
            </p>
          </div>
          <TripExpensesTable expenses={data.expenses} onAddExpense={handleAddExpense} />
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <MapPin className="size-4 text-primary" />
            <h2 className="font-semibold">Location history</h2>
          </div>
          <div className="mt-4 space-y-4">
            {data.locations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No location reported yet.</p>
            ) : (
              data.locations.slice(0, 8).map((location, index) => {
                const leg = legs.find((item) => item.id === String(location["trip_vehicle_id"]));
                return (
                  <div key={String(location["id"])} className="relative border-l pl-4 text-sm">
                    <span className="absolute -left-1 top-1 size-2 rounded-full bg-primary" />
                    <p className="font-medium">{formatValue(location["location"])}</p>
                    <p className="text-muted-foreground">
                      {leg?.vehicle ?? (index === 0 ? "Whole trip" : "Trip update")}
                      {location["checkpoint"] ? ` · ${location["checkpoint"]}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatValue(location["reported_at"])}
                      {location["reported_by"] ? ` · ${location["reported_by"]}` : ""}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </section>

      {tripEditor.dialog}
      {expenseEditor.dialog}
    </>
  );
}

export function RecordSummary({ config, recordId, slug }: { config: ModuleConfig; recordId: string; slug: string }) {
  const { data: row, isLoading, error } = useRecord(config, recordId);
  const { data: refs = {} } = useRefOptions(config.fields);
  const fx = useFxRate();
  const editor = useRecordEditor(config, row ? [row] : []);
  const titleKey = config.prefixKey ?? config.columns[0] ?? "id";
  const refLabel = (table: RefTable | undefined, id: unknown) =>
    table && id ? refs[table]?.find((o) => o.id === String(id))?.label ?? "—" : "—";
  const summaryFields = useMemo(
    () => config.fields.filter((field) => !field.readOnly || field.key === titleKey),
    [config.fields, titleKey],
  );

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading summary…</p>;
  if (error || !row)
    return (
      <Card className="p-8 text-center">
        <h1 className="font-semibold">Record not found</h1>
        <Button asChild variant="link">
          <Link to="/m/$slug" params={{ slug }}>
            Back to {config.title.toLowerCase()}
          </Link>
        </Button>
      </Card>
    );

  const backLink = (
    <Link
      to="/m/$slug"
      params={{ slug }}
      className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> All {config.title.toLowerCase()}
    </Link>
  );

  if (config.table === "trips") {
    return (
      <>
        {backLink}
        <TripSummary row={row} refs={refs} tripEditor={editor} />
      </>
    );
  }

  const route =
    row["origin"] && row["destination"] ? `${row["origin"]} → ${row["destination"]}` : config.subtitle;
  return (
    <>
      {backLink}
      <PageHeader
        title={String(row[titleKey] ?? config.title.replace(/s$/, ""))}
        subtitle={String(route)}
        actions={
          <Button onClick={() => editor.openEdit(row)}>
            <Pencil className="size-4" /> Edit record
          </Button>
        }
      />
      {editor.dialog}
      {config.statusKey ? (
        <div className="mb-4">
          <StatusBadge value={String(row[config.statusKey] ?? "")} />
        </div>
      ) : null}
      <ModuleStats table={config.table} rows={[row]} />
      <Card className="overflow-hidden">
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold">Record summary</h2>
          <p className="text-sm text-muted-foreground">Complete operational information for this record.</p>
        </div>
        <dl className="grid sm:grid-cols-2 xl:grid-cols-3">
          {summaryFields.map((field) => (
            <div key={field.key} className="min-w-0 border-b p-4 sm:border-r">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                {field.label ?? humanize(field.key)}
              </dt>
              <dd className="mt-1 break-words text-sm">
                <FieldValue field={field} row={row} config={config} fx={fx} refLabel={refLabel} />
              </dd>
            </div>
          ))}
        </dl>
      </Card>
    </>
  );
}
