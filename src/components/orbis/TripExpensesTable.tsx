import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./StatusBadge";
import { tzs } from "@/lib/money";
import type { RefTable } from "@/lib/modules";
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

  const visible =
    filter === "All"
      ? expenses
      : expenses.filter((e) => String(e["category"] ?? "") === filter);

  const total = visible.reduce((s, e) => s + Number(e["amount"] ?? 0), 0);

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
              <TableHead className="w-[160px] text-right">Amount (TZS)</TableHead>
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
              visible.map((e) => (
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
                  <TableCell className="whitespace-nowrap text-right font-medium">
                    {tzs(Number(e["amount"] ?? 0))}
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
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end border-t bg-muted/30 px-4 py-3 text-sm">
        <span className="mr-8 text-muted-foreground">Total expenses</span>
        <strong>{tzs(total)}</strong>
      </div>
    </div>
  );
}
