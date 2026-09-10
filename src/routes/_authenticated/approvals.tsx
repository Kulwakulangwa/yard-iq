import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { formatValue, logAudit } from "@/lib/orbis";
import { useSession } from "@/hooks/useSession";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/orbis/AppShell";
import { StatusBadge } from "@/components/orbis/StatusBadge";

export const Route = createFileRoute("/_authenticated/approvals")({
  head: () => ({ meta: [{ title: "Approvals & Exceptions — Orbis Logistics" }] }),
  component: Approvals,
});

const db = supabase as never as { from: (t: string) => any };

function Approvals() {
  const qc = useQueryClient();
  const { user } = useSession();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("Open");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["exceptions"],
    queryFn: async () => {
      const { data, error } = await db.from("exceptions").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const decide = useMutation({
    mutationFn: async ({ row, status }: { row: any; status: "Approved" | "Rejected" | "Resolved" }) => {
      if (row.created_by && user && row.created_by === user.id) {
        throw new Error("You cannot approve an exception you raised yourself.");
      }
      const { error } = await db
        .from("exceptions")
        .update({
          status,
          resolution_notes: notes[row.id] ?? null,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (error) throw error;
      await logAudit("exception_decision", "exceptions", row.id, { status });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exceptions"] });
      toast.success("Decision recorded");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const visible = rows.filter((r) => (filter === "All" ? true : r.status === filter));

  return (
    <>
      <PageHeader title="Approvals" subtitle="Every mismatch between the plan and reality lands here" />

      <div className="mb-4 flex flex-wrap gap-2">
        {["Open", "Approved", "Rejected", "Resolved", "All"].map((s) => (
          <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} onClick={() => setFilter(s)}>
            {s}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : visible.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Nothing here.</Card>
      ) : (
        <div className="space-y-3">
          {visible.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{r.exception_number}</span>
                <span className="text-sm text-muted-foreground">{r.exception_type}</span>
                <StatusBadge value={r.severity} />
                <StatusBadge value={r.status} />
                <span className="ml-auto text-xs text-muted-foreground">{formatValue(r.created_at)}</span>
              </div>
              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-md border p-2">
                  <p className="text-xs text-muted-foreground">Expected</p>
                  <p className="font-medium">{formatValue(r.expected_value)}</p>
                </div>
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2">
                  <p className="text-xs text-muted-foreground">Actual</p>
                  <p className="font-medium">{formatValue(r.actual_value)}</p>
                </div>
              </div>
              {r.reason ? <p className="mt-2 text-sm text-muted-foreground">{r.reason}</p> : null}

              {r.status === "Open" ? (
                <div className="mt-3 space-y-2">
                  <Textarea
                    placeholder="Resolution notes"
                    value={notes[r.id] ?? ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => decide.mutate({ row: r, status: "Approved" })}>
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => decide.mutate({ row: r, status: "Rejected" })}
                    >
                      Reject
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => decide.mutate({ row: r, status: "Resolved" })}>
                      Mark resolved
                    </Button>
                  </div>
                </div>
              ) : r.resolution_notes ? (
                <p className="mt-2 text-sm">{r.resolution_notes}</p>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
