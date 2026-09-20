import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, MapPin, Pencil, Plus } from "lucide-react";

import { db } from "@/lib/db";
import { modules, type ModuleConfig, type RefTable } from "@/lib/modules";
import { formatValue, humanize } from "@/lib/orbis";
import { useFxRate } from "@/lib/fx";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "./AppShell";
import { ConvoyLegList, useConvoyLegs } from "./ConvoyRows";
import { ModuleStats } from "./ModuleStats";
import { StatusBadge } from "./StatusBadge";
import { SuggestedDeduction } from "./SuggestedDeduction";
import { TripHeader } from "./TripHeader";
import { TripSummaryCards } from "./TripSummaryCards";
import { TripExpensesTable } from "./TripExpensesTable";
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

/** Map an incident type to a deduction category. */
function categoryFromIncidentType(t: unknown): string {
  switch (String(t ?? "")) {
    case "Missing Tire":
      return "Tire";
    case "Fuel Variance":
      return "Fuel";
    case "Damage":
    case "Theft Suspected":
    case "Accident":
      return "Damage";
    default:
      return "Other";
  }
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

  const { data: trucks = [] } = useQuery({
    queryKey: ["trip-vehicles-financial", tripId],
    queryFn: async () => {
      const { data, error } = await db
        .from("trip_vehicles")
        .select(
          "id, vehicle_id, trailer_id, driver_id, role, contract_amount, advance_paid_usd, advance_paid_tzs, fuel_budget_litres, fuel_budget_cost",
        )
        .eq("trip_id", tripId);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

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
      return {
        finance: finance.data as Row | null,
        expenses: (expenses.data ?? []) as Row[],
        locations: (locations.data ?? []) as Row[],
      };
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

      <TripSummaryCards finance={finance} expenses={data.expenses} trucks={trucks} fx={fx} />

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

/**
 * Compute the prefill + dedupe hint for the SuggestedDeduction button on
 * non-trip modules. Returns null when the module/record doesn't support it.
 */
function deductionSuggestion(config: ModuleConfig, row: Row): {
  prefill: Record<string, unknown>;
  dedupe: { key: string; value: string };
  label: string;
} | null {
  if (config.table === "incidents") {
    const impact = Number(row["financial_impact"] ?? 0);
    if (!impact || impact <= 0) return null;
    const incidentNumber = String(row["incident_number"] ?? "");
    const description = String(row["description"] ?? "");
    const driverId = row["driver_id"];
    if (!driverId) return null;
    return {
      prefill: {
        driver_id: driverId,
        category: categoryFromIncidentType(row["incident_type"]),
        amount_tzs: impact,
        reason:
          [incidentNumber, description].filter(Boolean).join(" — ") ||
          `Incident ${incidentNumber}`,
        trip_id: row["trip_id"] ?? undefined,
        vehicle_id: row["vehicle_id"] ?? undefined,
        tire_id: row["tire_id"] ?? undefined,
        incident_id: row["id"],
        status: "Pending",
      },
      dedupe: { key: "incident_id", value: String(row["id"]) },
      label: "Create deduction",
    };
  }

  if (config.table === "tires") {
    const status = String(row["status"] ?? "");
    if (status !== "Missing" && status !== "Disputed") return null;
    const serial = String(row["serial_number"] ?? "");
    return {
      prefill: {
        category: "Tire",
        reason: `${status} tire ${serial}`.trim(),
        vehicle_id: row["vehicle_id"] ?? undefined,
        tire_id: row["id"],
        status: "Pending",
      },
      dedupe: { key: "tire_id", value: String(row["id"]) },
      label: "Create tire deduction",
    };
  }

  return null;
}

export function RecordSummary({ config, recordId, slug }: { config: ModuleConfig; recordId: string; slug: string }) {
  const { data: row, isLoading, error } = useRecord(config, recordId);
  const { data: refs = {} } = useRefOptions(config.fields);
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

  const suggestion = deductionSuggestion(config, row);

  return (
    <>
      {backLink}
      <PageHeader
        title={String(row[titleKey] ?? config.title.replace(/s$/, ""))}
        subtitle={String(route)}
        actions={
          <>
            {suggestion ? (
              <SuggestedDeduction
                prefill={suggestion.prefill}
                dedupe={suggestion.dedupe}
                label={suggestion.label}
              />
            ) : null}
            <Button onClick={() => editor.openEdit(row)}>
              <Pencil className="size-4" /> Edit record
            </Button>
          </>
        }
      />

      {config.table === "incidents" && Number(row["financial_impact"] ?? 0) > 0 ? (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
          <span>
            This incident has a financial impact of{" "}
            <strong>{formatValue(row["financial_impact"])} TZS</strong>. Use{" "}
            <strong>Create deduction</strong> above to charge it to the responsible driver.
          </span>
        </div>
      ) : null}

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
              <dd className="mt-1 break-words text-sm font-medium">
                {field.type === "ref" ? (
                  refLabel(field.refTable, row[field.key])
                ) : field.key === config.statusKey ? (
                  <StatusBadge value={String(row[field.key] ?? "")} />
                ) : (
                  formatValue(row[field.key])
                )}
              </dd>
            </div>
          ))}
        </dl>
      </Card>
    </>
  );
}
