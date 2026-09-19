import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./StatusBadge";
import { dualDisplay, tzs } from "@/lib/money";
import { useFxRate } from "@/lib/fx";
import type { Row } from "./RecordEditor";

const CATEGORIES = [
  "Fuel",
  "Road Tolls",
  "Driver Mileage",
  "Container Drop-off",
  "Miscellaneous",
];

export function TripExpensesTable({
  expenses,
  onAddExpense,
}: {
  expenses: Row[];
  onAddExpense?: () => void;
}) {
  const [filter, setFilter] = useState<string>("All");
  const fx = useFxRate();

  const visible =
    filter === "All"
      ? expenses
      : expenses.filter((e) => String(e["category"] ?? "") === filter);

  // Total expressed in TZS, converted from each row's own currency.
  const totalTzs = visible.reduce((s, e) => {
    const amount = Number(e["amount"] ?? 0);
    const currency = String(e["currency"] ?? "TZS");
    return s + dualDisplay(amount, currency, fx).tzsValue;
  }, 0);
  const totalUsd = totalTzs / (fx > 0 ? fx : 2600);

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-3">
        <Button
          size="sm"
          variant={filter === "All" ? "default" : "ghost"}
          onClick={() => setFilter("All")}
          className="h-8"
        >
          All
        </Button>
        {CATEGORIES.map((c) => (
          <Button
            key={c}
            size="sm"
            variant={filter === c ? "default" : "ghost"}
            onClick={() => setFilter(c)}
            className="h-8"
          >
            {c}
          </Button>
        ))}
        {onAddExpense ? (
          <Button size="sm" className="ml-auto h-8" onClick={onAddExpense}>
            + Add expense
          </Button>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-[100px]">Volume</TableHead>
              <TableHead className="w-[180px] text-right">Amount</TableHead>
              <TableHead className="w-[110px]">Status</TableHead>
              <TableHead className="w-[90px]">Receipt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  No expenses logged.
                </TableCell>
              </TableRow>
            ) : (
              visible.map((e) => {
                const display = dualDisplay(
                  Number(e["amount"] ?? 0),
                  String(e["currency"] ?? "TZS"),
                  fx,
                );
                return (
                  <TableRow key={String(e["id"])}>
                    <TableCell className="font-medium">
                      {String(e["category"] ?? "—")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {String(e["notes"] ?? "—")}
                    </TableCell>
                    <TableCell>
                      {e["volume_liters"]
                        ? `${Number(e["volume_liters"]).toLocaleString()} L`
                        : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      <div className="font-medium">{display.primary}</div>
                      <div className="text-xs text-muted-foreground">
                        {display.secondary}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={String(e["status"] ?? "")} />
                    </TableCell>
                    <TableCell>
                      {e["receipt_url"] ? (
                        <a
                          href={String(e["receipt_url"])}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline"
                        >
                          View
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end gap-8 border-t bg-muted/30 px-4 py-3 text-sm">
        <span className="text-muted-foreground">Total expenses</span>
        <div className="text-right">
          <div className="font-semibold">{tzs(totalTzs)}</div>
          <div className="text-xs text-muted-foreground">
            USD {new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(totalUsd)}
          </div>
        </div>
      </div>
    </div>
  );
}
