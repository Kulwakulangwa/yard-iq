import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Fuel, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { db } from "@/lib/db";
import { modules } from "@/lib/modules";
import { dualDisplay, tzs, usd } from "@/lib/money";
import { logAudit } from "@/lib/orbis";
import { useFxRate } from "@/lib/fx";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRecordEditor, type Row } from "./RecordEditor";

const DEALER_PAYMENT = "Our dealer / account";

export function TripFuelSection({ tripId }: { tripId: string }) {
  const qc = useQueryClient();
  const fx = useFxRate();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["fuel-transactions-trip", tripId],
    queryFn: async () => {
      const [tx, vehicles, drivers] = await Promise.all([
        db
          .from("fuel_transactions")
          .select("*")
          .eq("trip_id", tripId)
          .order("transaction_date", { ascending: true }),
        db.from("vehicles").select("id, registration_number"),
        db.from("drivers").select("id, full_name"),
      ]);
      const vehicleById = new Map(
        ((vehicles.data ?? []) as Row[]).map((v) => [
          String(v.id),
          String(v.registration_number ?? ""),
        ]),
      );
      const driverById = new Map(
        ((drivers.data ?? []) as Row[]).map((d) => [
          String(d.id),
          String(d.full_name ?? ""),
        ]),
      );
      return ((tx.data ?? []) as Row[]).map((r) => ({
        ...r,
        _vehicle: vehicleById.get(String(r["vehicle_id"])) ?? "—",
        _driver: driverById.get(String(r["driver_id"])) ?? "—",
      }));
    },
  });

  const editor = useRecordEditor(modules.fuel_transactions, rows);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("fuel_transactions").delete().eq("id", id);
      if (error) throw error;
      await logAudit("delete", "fuel_transactions", id, {});
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fuel-transactions-trip", tripId] });
      qc.invalidateQueries({ queryKey: ["fuel-transactions-page"] });
      qc.invalidateQueries({ queryKey: ["vehicle-profile"] });
      qc.invalidateQueries({ queryKey: ["trip-summary", tripId] });
      qc.invalidateQueries({ queryKey: ["office-dashboard"] });
      toast.success("Fuel entry deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stats = useMemo(() => {
    let totalLitres = 0;
    let totalCostTzs = 0;
    let dealerLitres = 0;
    let dealerCostTzs = 0;
    let elsewhereLitres = 0;
    let elsewhereCostTzs = 0;

    for (const r of rows) {
      const litres = Number(r["litres"] ?? 0);
      const cost = Number(r["total_cost"] ?? 0);
      const currency = String(r["currency"] ?? "TZS");
      const costTzs = dualDisplay(cost, currency, fx).tzsValue;
      const payment = String(r["payment_method"] ?? "");

      totalLitres += litres;
      totalCostTzs += costTzs;

      if (payment === DEALER_PAYMENT) {
        dealerLitres += litres;
        dealerCostTzs += costTzs;
      } else {
        elsewhereLitres += litres;
        elsewhereCostTzs += costTzs;
      }
    }

    return {
      totalLitres,
      totalCostTzs,
      dealerLitres,
      dealerCostTzs,
      elsewhereLitres,
      elsewhereCostTzs,
    };
  }, [rows, fx]);

  function handleAdd() {
    editor.openNew({
      trip_id: tripId,
      transaction_date: new Date().toISOString().slice(0, 10),
      fuel_type: "Diesel",
      currency: "TZS",
      payment_method: DEALER_PAYMENT,
    });
  }

  return (
    <>
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <div>
            <h2 className="font-semibold">Fuel purchases</h2>
            <p className="text-sm text-muted-foreground">
              Every fuel transaction on this trip — dealer and elsewhere.
            </p>
          </div>
          <Button size="sm" onClick={handleAdd}>
            <Plus className="size-4" /> Add fuel entry
          </Button>
        </div>

        {/* Summary tiles */}
        {rows.length > 0 ? (
          <div className="grid gap-3 border-b bg-muted/20 p-4 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Total litres
              </p>
              <p className="mt-1 text-lg font-semibold">
                {stats.totalLitres.toLocaleString()} L
              </p>
              <p className="text-xs text-muted-foreground">
                {rows.length} entr{rows.length === 1 ? "y" : "ies"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Total fuel cost
              </p>
              <p className="mt-1 text-lg font-semibold">{tzs(stats.totalCostTzs)}</p>
              <p className="text-xs text-muted-foreground">
                {usd(stats.totalCostTzs / (fx > 0 ? fx : 2600))}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Dealer vs elsewhere
              </p>
              <div className="mt-1 space-y-0.5 text-sm">
                <div>
                  <span className="text-primary">
                    {stats.dealerLitres.toLocaleString()} L
                  </span>{" "}
                  <span className="text-xs text-muted-foreground">dealer</span>
                </div>
                <div>
                  <span className="text-warning-foreground">
                    {stats.elsewhereLitres.toLocaleString()} L
                  </span>{" "}
                  <span className="text-xs text-muted-foreground">elsewhere</span>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Transactions table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Litres</TableHead>
                <TableHead className="text-right">Price/L</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8}>Loading…</TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground">
                    No fuel recorded for this trip yet. Click{" "}
                    <strong>Add fuel entry</strong> to log the first purchase.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => {
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
                  return (
                    <TableRow key={String(r["id"])} className="align-top">
                      <TableCell className="whitespace-nowrap">
                        {String(r["transaction_date"] ?? "—").slice(0, 10)}
                      </TableCell>
                      <TableCell className="max-w-[180px]">
                        <div className="truncate">
                          {String(r["location"] ?? "—")}
                        </div>
                        {r["country"] ? (
                          <div className="text-xs text-muted-foreground">
                            {String(r["country"])}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="max-w-[160px]">
                        <span className="truncate">
                          {String(r["supplier"] ?? "—")}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right font-medium">
                        {Number(r["litres"] ?? 0).toLocaleString()} L
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs">
                        <div>{priceDisplay.primary}</div>
                        <div className="text-muted-foreground">
                          {priceDisplay.secondary}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <div className="font-medium">{display.primary}</div>
                        <div className="text-xs text-muted-foreground">
                          {display.secondary}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs ${
                            isDealer
                              ? "border-primary/40 bg-primary/5 text-primary"
                              : "border-warning/40 bg-warning/5"
                          }`}
                        >
                          {String(r["payment_method"] ?? "—")}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => editor.openEdit(r)}
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
      </Card>

      {editor.dialog}
    </>
  );
}
