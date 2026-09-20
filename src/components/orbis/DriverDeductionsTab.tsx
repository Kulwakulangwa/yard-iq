import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Check, Plus, ShieldOff, Wallet } from "lucide-react";
import { toast } from "sonner";

import { db } from "@/lib/db";
import { modules } from "@/lib/modules";
import { logAudit } from "@/lib/orbis";
import { tzs } from "@/lib/money";
import { useSession } from "@/hooks/useSession";
import { useRecordEditor } from "./RecordEditor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "./StatusBadge";
import { Stat } from "./Stat";

type Deduction = {
  id: string;
  driver_id: string;
  deduction_date: string;
  category: string;
  amount_tzs: number;
  reason: string | null;
  trip_id: string | null;
  vehicle_id: string | null;
  tire_id: string | null;
  fuel_allocation_id: string | null;
  incident_id: string | null;
  status: string;
  settled_at: string | null;
  settled_notes: string | null;
  created_at: string;
};

function formatDate(value: unknown) {
  if (!value) return "—";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const CATEGORY_LABELS: Record<string, string> = {
  Fuel: "Fuel",
  Tire: "Tire",
  Damage: "Damage",
  "Cash Advance": "Cash advance",
  Other: "Other",
};

export function DriverDeductionsTab({
  driverId,
  advances,
}: {
  driverId: string;
  advances: number;
}) {
  const qc = useQueryClient();
  const session = useSession() as { user?: unknown; isAdmin?: boolean; roles?: string[] };
  const canEdit = Boolean(
    session.isAdmin ||
      (session.roles ?? []).some((r) =>
        ["admin", "operations_manager", "finance_officer"].includes(r),
      ),
  );

  const { data: deductions = [], isLoading } = useQuery({
    queryKey: ["driver-deductions", driverId],
    queryFn: async () => {
      const { data, error } = await db
        .from("driver_deductions")
        .select("*")
        .eq("driver_id", driverId)
        .order("deduction_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Deduction[];
    },
  });

  const editor = useRecordEditor(modules.driver_deductions, deductions);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const patch: Record<string, unknown> = { status };
      if (status === "Settled") patch["settled_at"] = new Date().toISOString();
      const { error } = await db.from("driver_deductions").update(patch).eq("id", id);
      if (error) throw error;
      await logAudit("deduction_" + status.toLowerCase(), "driver_deductions", id, patch);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["driver-deductions", driverId] });
      qc.invalidateQueries({ queryKey: ["driver-profile", driverId] });
      toast.success("Deduction updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const outstanding = deductions
    .filter((d) => d.status === "Pending" || d.status === "Approved")
    .reduce((s, d) => s + Number(d.amount_tzs ?? 0), 0);

  const settled = deductions.filter((d) => d.status === "Settled");
  const settledTotal = settled.reduce((s, d) => s + Number(d.amount_tzs ?? 0), 0);

  const waived = deductions.filter((d) => d.status === "Waived");
  const waivedTotal = waived.reduce((s, d) => s + Number(d.amount_tzs ?? 0), 0);

  function openNewDeduction() {
    editor.openNew({
      driver_id: driverId,
      deduction_date: new Date().toISOString().slice(0, 10),
      category: "Other",
      status: "Pending",
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Advances received"
          value={tzs(advances)}
          sub="Trip + extra advances"
          tone="amber"
        />
        <Stat
          label="Outstanding"
          value={tzs(outstanding)}
          sub={`${deductions.filter((d) => d.status === "Pending" || d.status === "Approved").length} open`}
          tone={outstanding > 0 ? "red" : "green"}
        />
        <Stat
          label="Settled lifetime"
          value={tzs(settledTotal)}
          sub={`${settled.length} settled · ${tzs(waivedTotal)} waived`}
          tone="green"
        />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <div>
            <h2 className="font-semibold">Deductions</h2>
            <p className="text-sm text-muted-foreground">
              Money the driver owes for fuel, tires, damage and other costs.
            </p>
          </div>
          {canEdit ? (
            <Button size="sm" onClick={openNewDeduction}>
              <Plus className="size-4" /> Record deduction
            </Button>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                {canEdit ? <TableHead className="text-right">Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={canEdit ? 6 : 5}>Loading…</TableCell>
                </TableRow>
              ) : deductions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canEdit ? 6 : 5} className="text-muted-foreground">
                    No deductions recorded.
                  </TableCell>
                </TableRow>
              ) : (
                deductions.map((d) => {
                  const isPending = d.status === "Pending";
                  const isApproved = d.status === "Approved";
                  const isOpen = isPending || isApproved;
                  const isSettled = d.status === "Settled";
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(d.deduction_date)}
                      </TableCell>
                      <TableCell>
                        <span className="rounded-full border px-2 py-0.5 text-xs">
                          {CATEGORY_LABELS[d.category] ?? d.category}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-md">
                        <div className="truncate text-sm">{d.reason ?? "—"}</div>
                        {isSettled && d.settled_notes ? (
                          <div className="truncate text-xs text-muted-foreground">
                            {d.settled_notes}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right font-medium">
                        {tzs(d.amount_tzs)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge value={d.status} />
                      </TableCell>
                      {canEdit ? (
                        <TableCell className="text-right">
                          {isOpen ? (
                            <div className="flex justify-end gap-1">
                              {isPending ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-primary hover:text-primary"
                                  onClick={() =>
                                    updateStatus.mutate({ id: d.id, status: "Approved" })
                                  }
                                  disabled={updateStatus.isPending}
                                >
                                  <Check className="size-4" /> Approve
                                </Button>
                              ) : null}
                              {isApproved ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-success hover:text-success"
                                  onClick={() =>
                                    updateStatus.mutate({ id: d.id, status: "Settled" })
                                  }
                                  disabled={updateStatus.isPending}
                                >
                                  <Wallet className="size-4" /> Settle
                                </Button>
                              ) : null}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-muted-foreground"
                                onClick={() =>
                                  updateStatus.mutate({ id: d.id, status: "Waived" })
                                }
                                disabled={updateStatus.isPending}
                              >
                                <ShieldOff className="size-4" /> Waive
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {!canEdit && deductions.length > 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <AlertCircle className="size-3.5" />
          Only managers can approve, settle or waive deductions.
        </p>
      ) : null}

      {editor.dialog}
    </div>
  );
}
