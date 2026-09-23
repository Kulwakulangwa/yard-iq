import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Fuel, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { db } from "@/lib/db";
import { modules } from "@/lib/modules";
import { dualDisplay, tzs, usd } from "@/lib/money";
import { logAudit, formatValue } from "@/lib/orbis";
import { useFxRate } from "@/lib/fx";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "./AppShell";
import { StatusBadge } from "./StatusBadge";
import { useRecordEditor, type Row } from "./RecordEditor";

const DEALER_PAYMENT = "Our dealer / account";

const PAYMENT_METHODS = [
  "Our dealer / account",
  "Cash",
  "Mobile money",
  "Bank transfer",
  "Driver paid",
  "Company paid",
  "Other",
];

// Statuses the user can still edit. Once finance moves the linked
// expense to Approved / Paid / Rejected, the fuel row is locked.
const EDITABLE_FUEL_STATUSES = ["Draft", "Submitted"];

export function FuelManagementPage() {
  return (
    <>
      <PageHeader
        title="Fuel Management"
        subtitle="Every fuel purchase and office-side budget, in one place."
      />
      <Tabs defaultValue="transactions" className="w-full">
        <div className="overflow-x-auto">
          <TabsList className="w-max">
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="allocations">Allocations</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="transactions" className="mt-4">
          <TransactionsTab />
        </TabsContent>

        <TabsContent value="allocations" className="mt-4">
          <AllocationsTab />
        </TabsContent>
      </Tabs>
    </>
  );
}

/* ────────────────────────────────────────────────────────── */
/* TRANSACTIONS TAB                                            */
/* ────────────────────────────────────────────────────────── */

function TransactionsTab() {
  const qc = useQueryClient();
  const fx = useFxRate();
  const [term, setTerm] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("All");
  const [paymentFilter, setPaymentFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const { data, isLoading } = useQuery({
    queryKey: ["fuel-transactions-page"],
    queryFn: async () => {
      const [tx, trips, vehicles, drivers] = await Promise.all([
        db.from("fuel_transactions").select("*").order("transaction_date", { ascending: false }),
        db.from("trips").select("id, trip_number, origin, destination"),
        db.from("vehicles").select("id, registration_number"),
        db.from("drivers").select("id, full_name"),
      ]);
      return {
        transactions: (tx.data ?? []) as Row[],
        trips: (trips.data ?? []) as Row[],
        vehicles: (vehicles.data ?? []) as Row[],
        drivers: (drivers.data ?? []) as Row[],
      };
    },
  });

  const rows = data?.transactions ?? [];
  const tripById = useMemo(() => {
    const m = new Map<string, Row>();
    (data?.trips ?? []).forEach((t) => m.set(String(t.id), t));
    return m;
  }, [data]);
  const vehicleById = useMemo(() => {
    const m = new Map<string, string>();
    (data?.vehicles ?? []).forEach((v) => m.set(String(v.id), String(v.registration_number ?? "")));
    return m;
  }, [data]);
  const driverById = useMemo(() => {
    const m = new Map<string, string>();
    (data?.drivers ?? []).forEach((d) => m.set(String(d.id), String(d.full_name ?? "")));
    return m;
  }, [data]);

  const editor = useRecordEditor(modules.fuel_transactions, rows);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("fuel_transactions").delete().eq("id", id);
      if (error) throw error;
      await logAudit("delete", "fuel_transactions", id, {});
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fuel-transactions-page"] });
      qc.invalidateQueries({ queryKey: ["trip-summary"] });
      qc.invalidateQueries({ queryKey: ["vehicle-profile"] });
      qc.invalidateQueries({ queryKey: ["office-dashboard"] });
      toast.success("Fuel transaction deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const suppliers = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => {
      const v = String(r["supplier"] ?? "").trim();
      if (v) s.add(v);
    });
    return ["All", ...Array.from(s).sort()];
  }, [rows]);

  const stats = useMemo(() => {
    let totalLitres = 0;
    let totalCostTzs = 0;
    let dealerLitres = 0;
    let elsewhereLitres = 0;
    let pendingLitres = 0;
    for (const r of rows) {
      const litres = Number(r["litres"] ?? 0);
      const cost = Number(r["total_cost"] ?? 0);
      const currency = String(r["currency"] ?? "TZS");
      const payment = String(r["payment_method"] ?? "");
      const status = String(r["status"] ?? "Draft");
      totalLitres += litres;
      totalCostTzs += dualDisplay(cost, currency, fx).tzsValue;
      if (payment === DEALER_PAYMENT) dealerLitres += litres;
      else elsewhereLitres += litres;
      if (status === "Submitted") pendingLitres += litres;
    }
    return { totalLitres, totalCostTzs, dealerLitres, elsewhereLitres, pendingLitres };
  }, [rows, fx]);

  const visible = useMemo(() => {
    const t = term.trim().toLowerCase();
    return rows.filter((r) => {
      if (supplierFilter !== "All" && String(r["supplier"] ?? "") !== supplierFilter) return false;
      if (paymentFilter !== "All" && String(r["payment_method"] ?? "") !== paymentFilter) return false;
      if (statusFilter !== "All") {
        const s = String(r["status"] ?? "Draft");
        if (statusFilter === "Pending finance" && s !== "Submitted") return false;
        if (statusFilter === "Draft" && s !== "Draft") return false;
        if (statusFilter === "Processed" && !["Approved", "Paid", "Rejected"].includes(s)) return false;
      }
      if (!t) return true;
      const trip = tripById.get(String(r["trip_id"]));
      const vehicle = vehicleById.get(String(r["vehicle_id"])) ?? "";
      const driver = driverById.get(String(r["driver_id"])) ?? "";
      const haystack = [
        r["reference"],
        r["location"],
        r["country"],
        r["supplier"],
        r["receipt_number"],
        r["notes"],
        r["status"],
        trip?.trip_number,
        vehicle,
        driver,
      ]
        .map((v) => String(v ?? "").toLowerCase())
        .join(" ");
      return haystack.includes(t);
    });
  }, [rows, term, supplierFilter, paymentFilter, statusFilter, tripById, vehicleById, driverById]);

  function handleNew() {
    editor.openNew({
      transaction_date: new Date().toISOString().slice(0, 10),
      fuel_type: "Diesel",
      currency: "TZS",
      payment_method: DEALER_PAYMENT,
      status: "Draft",
    });
  }

  return (
    <>
      {/* Four stat tiles */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Total litres"
          primary={`${stats.totalLitres.toLocaleString()} L`}
          secondary={`${rows.length} entr${rows.length === 1 ? "y" : "ies"}`}
        />
        <StatTile
          label="Total cost"
          primary={tzs(stats.totalCostTzs)}
          secondary={usd(stats.totalCostTzs / (fx > 0 ? fx : 2600))}
        />
        <StatTile
          label="Awaiting finance"
          primary={`${stats.pendingLitres.toLocaleString()} L`}
          secondary="Submitted for approval"
          tone="amber"
        />
        <StatTile
          label="Our dealer"
          primary={`${stats.dealerLitres.toLocaleString()} L`}
          secondary="Dealer / account"
          tone="primary"
        />
      </div>

      {/* Filters */}
      <Card className="mt-5 p-3 sm:p-4">
        <div className="mb-3 grid gap-3 lg:grid-cols-[1fr_180px_180px_180px]">
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search trip, truck, driver, location, supplier, receipt…"
          />
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {suppliers.map((s) => (
              <option key={s} value={s}>
                {s === "All" ? "All suppliers" : s}
              </option>
            ))}
          </select>
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="All">All payment methods</option>
            {PAYMENT_METHODS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="All">All statuses</option>
            <option value="Draft">Draft</option>
            <option value="Pending finance">Pending finance</option>
            <option value="Processed">Processed (Approved / Paid / Rejected)</option>
          </select>
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Submitted entries flow into <strong>Expenses</strong> for finance to verify.
            Once approved, rejected or paid, this row locks and shows the decision.
          </p>
          <Button onClick={handleNew}>
            <Plus className="size-4" /> New fuel entry
          </Button>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Trip</TableHead>
                <TableHead>Truck</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Litres</TableHead>
                <TableHead className="text-right">Price/L</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Receipt</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={13}>Loading…</TableCell>
                </TableRow>
              ) : visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13}>No fuel transactions yet.</TableCell>
                </TableRow>
              ) : (
                visible.map((r) => {
                  const trip = tripById.get(String(r["trip_id"]));
                  const vehicle = vehicleById.get(String(r["vehicle_id"])) ?? "—";
                  const driver = driverById.get(String(r["driver_id"])) ?? "—";
                  const display = dualDisplay(
                    Number(r["total_cost"] ?? 0),
                    String(r["currency"] ?? "TZS"),
                    fx,
                  );
                  const priceDisplay = dualDisplay(
                    Number(r["price_per_litre"] ?? 0),
                    String(r["currency"] ?? "TZS"),
                    fx,
                  );
                  const isDealer = String(r["payment_method"] ?? "") === DEALER_PAYMENT;
                  const status = String(r["status"] ?? "Draft");
                  const isEditable = EDITABLE_FUEL_STATUSES.includes(status);
                  const isSubmitted = status === "Submitted";

                  return (
                    <TableRow key={String(r["id"])} className="align-top">
                      <TableCell className="whitespace-nowrap">
                        {String(r["transaction_date"] ?? "—").slice(0, 10)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="font-medium text-primary">
                          {trip?.trip_number ?? "—"}
                        </div>
                        {trip ? (
                          <div className="text-xs text-muted-foreground">
                            {trip.origin} → {trip.destination}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-medium">{vehicle}</TableCell>
                      <TableCell className="whitespace-nowrap">{driver}</TableCell>
                      <TableCell className="max-w-[180px]">
                        <div className="truncate">{String(r["location"] ?? "—")}</div>
                        {r["country"] ? (
                          <div className="text-xs text-muted-foreground">
                            {String(r["country"])}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="max-w-[140px]">
                        <span className="truncate">{String(r["supplier"] ?? "—")}</span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right font-medium">
                        {Number(r["litres"] ?? 0).toLocaleString()} L
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs">
                        <div>{priceDisplay.primary}</div>
                        <div className="text-muted-foreground">{priceDisplay.secondary}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <div className="font-medium">{display.primary}</div>
                        <div className="text-xs text-muted-foreground">
                          {display.secondary}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <StatusBadge value={status} />
                          {isSubmitted ? (
                            <span className="text-[10px] text-muted-foreground">
                              Pending finance
                            </span>
                          ) : status === "Paid" ? (
                            <span className="text-[10px] text-muted-foreground">Paid by finance</span>
                          ) : status === "Approved" ? (
                            <span className="text-[10px] text-muted-foreground">Approved by finance</span>
                          ) : status === "Rejected" ? (
                            <span className="text-[10px] text-muted-foreground">Rejected by finance</span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span
                          className={`inline-block rounded-full border px-2 py-0.5 text-xs ${
                            isDealer
                              ? "border-primary/40 bg-primary/5 text-primary"
                              : "border-warning/40 bg-warning/5"
                          }`}
                        >
                          {String(r["payment_method"] ?? "—")}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {r["receipt_url"] ? (
                          <a
                            href={String(r["receipt_url"])}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline"
                          >
                            View
                          </a>
                        ) : r["receipt_number"] ? (
                          String(r["receipt_number"])
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => editor.openEdit(r)}
                            disabled={!isEditable}
                            title={
                              isEditable
                                ? "Edit"
                                : "Locked — already processed by finance"
                            }
                            aria-label="Edit"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              if (
                                typeof window !== "undefined" &&
                                window.confirm(
                                  `Delete fuel entry ${String(r["reference"] ?? "")}?`,
                                )
                              ) {
                                remove.mutate(String(r["id"]));
                              }
                            }}
                            disabled={!isEditable}
                            title={
                              isEditable
                                ? "Delete"
                                : "Locked — already processed by finance"
                            }
                            aria-label="Delete"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {visible.length > 0 ? (
          <div className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-3">
            <div className="text-sm">
              <span className="text-muted-foreground">Filtered: </span>
              <strong>{visible.length}</strong> entr{visible.length === 1 ? "y" : "ies"}
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Total litres: </span>
              <strong>
                {visible.reduce((s, r) => s + Number(r["litres"] ?? 0), 0).toLocaleString()} L
              </strong>
            </div>
            <div className="text-sm sm:text-right">
              <span className="text-muted-foreground">Total cost: </span>
              <strong>
                {tzs(
                  visible.reduce(
                    (s, r) =>
                      s +
                      dualDisplay(
                        Number(r["total_cost"] ?? 0),
                        String(r["currency"] ?? "TZS"),
                        fx,
                      ).tzsValue,
                    0,
                  ),
                )}
              </strong>
            </div>
          </div>
        ) : null}
      </Card>

      {editor.dialog}
    </>
  );
}

/* ────────────────────────────────────────────────────────── */
/* ALLOCATIONS TAB                                             */
/* ────────────────────────────────────────────────────────── */

function AllocationsTab() {
  const fx = useFxRate();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["fuel-allocations-page"],
    queryFn: async () => {
      const { data, error } = await db
        .from("fuel_allocations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const editor = useRecordEditor(modules.fuel_allocations, rows);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Office-side budget lines. For actual purchases, use the Transactions tab.
        </p>
        <Button onClick={() => editor.openNew()}>
          <Plus className="size-4" /> New allocation
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ref</TableHead>
                <TableHead>Trip</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Fuel type</TableHead>
                <TableHead className="text-right">Planned L</TableHead>
                <TableHead className="text-right">Approved L</TableHead>
                <TableHead className="text-right">Fuel cost</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10}>Loading…</TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10}>No allocations yet.</TableCell>
                </TableRow>
              ) : (
                rows.map((r) => {
                  const display = dualDisplay(
                    Number(r["fuel_cost"] ?? 0),
                    String(r["currency"] ?? "TZS"),
                    fx,
                  );
                  return (
                    <TableRow key={String(r["id"])}>
                      <TableCell className="whitespace-nowrap font-medium">
                        {String(r["reference"] ?? "—")}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {String(r["trip_id"] ?? "—").slice(0, 8)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {String(r["vehicle_id"] ?? "—").slice(0, 8)}
                      </TableCell>
                      <TableCell>{String(r["fuel_type"] ?? "—")}</TableCell>
                      <TableCell className="text-right">
                        {Number(r["planned_litres"] ?? 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(r["approved_litres"] ?? 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <div className="font-medium">{display.primary}</div>
                        <div className="text-xs text-muted-foreground">
                          {display.secondary}
                        </div>
                      </TableCell>
                      <TableCell>{String(r["supplier"] ?? "—")}</TableCell>
                      <TableCell>
                        <StatusBadge value={String(r["status"] ?? "")} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => editor.openEdit(r)}
                          aria-label="Edit"
                        >
                          <Pencil className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {editor.dialog}
    </>
  );
}

/* ────────────────────────────────────────────────────────── */
/* Small presentational helper                                 */
/* ────────────────────────────────────────────────────────── */

function StatTile({
  label,
  primary,
  secondary,
  tone = "default",
}: {
  label: string;
  primary: string;
  secondary: string;
  tone?: "default" | "primary" | "amber";
}) {
  const toneClass =
    tone === "primary"
      ? "text-primary"
      : tone === "amber"
        ? "text-warning-foreground"
        : "text-foreground";
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <Fuel className="size-4 text-muted-foreground" />
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      </div>
      <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{primary}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{secondary}</p>
    </Card>
  );
}
