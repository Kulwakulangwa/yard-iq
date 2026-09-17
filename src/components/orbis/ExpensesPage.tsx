import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, Receipt as ReceiptIcon, XCircle } from "lucide-react";
import { toast } from "sonner";

import { db } from "@/lib/db";
import { tzs } from "@/lib/money";
import { logAudit } from "@/lib/orbis";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "./AppShell";
import { StatusBadge } from "./StatusBadge";
import type { Row } from "./RecordEditor";

const VERIFIED_STATUSES = ["Approved", "Paid"];
const PENDING_STATUSES = ["Draft", "Submitted"];

const CATEGORIES = [
  "Fuel",
  "Road Tolls",
  "Driver Mileage",
  "Container Drop-off",
  "Miscellaneous",
  "Trip",
  "Maintenance",
  "Yard",
  "Administrative",
  "Emergency",
  "Other",
];

const STATUS_FILTERS = ["All", "Pending", "Verified", "Rejected"];

function matchStatusFilter(status: string, filter: string) {
  if (filter === "All") return true;
  if (filter === "Verified") return VERIFIED_STATUSES.includes(status);
  if (filter === "Pending") return PENDING_STATUSES.includes(status);
  if (filter === "Rejected") return status === "Rejected";
  return true;
}

export function ExpensesPage() {
  const qc = useQueryClient();
  const [term, setTerm] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const { data, isLoading } = useQuery({
    queryKey: ["expenses-page"],
    queryFn: async () => {
      const [expenses, trips, vehicles, drivers] = await Promise.all([
        db.from("expenses").select("*").order("expense_date", { ascending: false }),
        db.from("trips").select("id, trip_number, origin, destination, vehicle_id, driver_id"),
        db.from("vehicles").select("id, registration_number"),
        db.from("drivers").select("id, full_name"),
      ]);
      return {
        expenses: (expenses.data ?? []) as Row[],
        trips: (trips.data ?? []) as Row[],
        vehicles: (vehicles.data ?? []) as Row[],
        drivers: (drivers.data ?? []) as Row[],
      };
    },
  });

  const tripsById = useMemo(() => {
    const m = new Map<string, Row>();
    (data?.trips ?? []).forEach((t) => m.set(String(t.id), t));
    return m;
  }, [data]);

  const vehicleById = useMemo(() => {
    const m = new Map<string, string>();
    (data?.vehicles ?? []).forEach((v) =>
      m.set(String(v.id), String(v.registration_number ?? "")),
    );
    return m;
  }, [data]);

  const driverById = useMemo(() => {
    const m = new Map<string, string>();
    (data?.drivers ?? []).forEach((d) => m.set(String(d.id), String(d.full_name ?? "")));
    return m;
  }, [data]);

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await db.from("expenses").update({ status }).eq("id", id);
      if (error) throw error;
      await logAudit("expense_review", "expenses", id, { status });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses-page"] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["trip-summary"] });
      qc.invalidateQueries({ queryKey: ["office-dashboard"] });
      toast.success("Expense updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data?.expenses ?? [];

  const stats = useMemo(() => {
    let total = 0;
    let verified = 0;
    let pending = 0;
    for (const r of rows) {
      const amt = Number(r["amount"] ?? 0);
      total += amt;
      const s = String(r["status"] ?? "");
      if (VERIFIED_STATUSES.includes(s)) verified += amt;
      if (PENDING_STATUSES.includes(s)) pending += amt;
    }
    return { total, verified, pending };
  }, [rows]);

  const visible = useMemo(() => {
    const t = term.trim().toLowerCase();
    return rows.filter((r) => {
      if (catFilter !== "All" && String(r["category"] ?? "") !== catFilter) return false;
      if (!matchStatusFilter(String(r["status"] ?? ""), statusFilter)) return false;
      if (!t) return true;
      const trip = tripsById.get(String(r["trip_id"]));
      const driverName = trip ? driverById.get(String(trip.driver_id)) : "";
      const vehicleReg = r["vehicle_id"]
        ? vehicleById.get(String(r["vehicle_id"]))
        : trip
          ? vehicleById.get(String(trip.vehicle_id))
          : "";
      const haystack = [
        r["expense_number"],
        r["notes"],
        r["category"],
        r["supplier"],
        trip?.trip_number,
        trip?.origin,
        trip?.destination,
        driverName,
        vehicleReg,
      ]
        .map((v) => String(v ?? "").toLowerCase())
        .join(" ");
      return haystack.includes(t);
    });
  }, [rows, term, catFilter, statusFilter, tripsById, driverById, vehicleById]);

  return (
    <>
      <PageHeader
        title="Expenses"
        subtitle="Ledger of every trip expense — fuel, tolls, parking and more."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          icon={<ReceiptIcon className="size-5 text-warning-foreground" />}
          label="Total logged"
          value={tzs(stats.total)}
        />
        <SummaryCard
          icon={<CheckCircle2 className="size-5 text-success" />}
          label="Verified"
          value={tzs(stats.verified)}
        />
        <SummaryCard
          icon={<Clock className="size-5 text-warning-foreground" />}
          label="Pending review"
          value={tzs(stats.pending)}
        />
      </div>

      <Card className="mt-5 p-3 sm:p-4">
        <div className="mb-3 grid gap-3 lg:grid-cols-[1fr_180px_180px]">
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search trip, driver, vehicle, description…"
          />
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="All">All</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s === "All" ? "All" : s}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trip</TableHead>
                <TableHead>Driver / Vehicle</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Receipt</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8}>Loading…</TableCell>
                </TableRow>
              ) : visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>No expenses match.</TableCell>
                </TableRow>
              ) : (
                visible.map((r) => {
                  const trip = tripsById.get(String(r["trip_id"]));
                  const status = String(r["status"] ?? "");
                  const isPending = PENDING_STATUSES.includes(status);
                  const vehicleReg = r["vehicle_id"]
                    ? vehicleById.get(String(r["vehicle_id"]))
                    : trip
                      ? vehicleById.get(String(trip.vehicle_id))
                      : null;
                  const driverName = trip
                    ? driverById.get(String(trip.driver_id))
                    : null;
                  const volume = r["volume_liters"]
                    ? ` (${Number(r["volume_liters"]).toLocaleString()} L)`
                    : "";
                  const description = `${String(r["notes"] ?? "—")}${volume}`.trim();

                  return (
                    <TableRow key={String(r["id"])}>
                      <TableCell className="max-w-[180px] whitespace-nowrap align-top">
                        <div className="font-medium text-primary">
                          {trip?.trip_number ?? "—"}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {trip ? `${trip.origin} → ${trip.destination}` : "No trip"}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap align-top">
                        <div className="font-medium">{driverName ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          {vehicleReg ?? "—"}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <span className="rounded-full border px-2 py-0.5 text-xs">
                          {String(r["category"] ?? "—")}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[220px] align-top">
                        <span className="block truncate">{description || "—"}</span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right align-top font-medium">
                        {tzs(r["amount"])}
                      </TableCell>
                      <TableCell className="align-top text-xs">
                        {r["receipt_url"] ? (
                          <a
                            href={String(r["receipt_url"])}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline"
                          >
                            View
                          </a>
                        ) : (
                          <span className="text-muted-foreground">None</span>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <StatusBadge value={status} />
                      </TableCell>
                      <TableCell className="text-right align-top">
                        {isPending ? (
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-success hover:text-success"
                              onClick={() =>
                                setStatus.mutate({
                                  id: String(r["id"]),
                                  status: "Approved",
                                })
                              }
                            >
                              <CheckCircle2 className="size-4" /> Verify
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() =>
                                setStatus.mutate({
                                  id: String(r["id"]),
                                  status: "Rejected",
                                })
                              }
                            >
                              <XCircle className="size-4" /> Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex size-9 items-center justify-center rounded-md border bg-muted/40">
        {icon}
      </div>
      <p className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </Card>
  );
}
