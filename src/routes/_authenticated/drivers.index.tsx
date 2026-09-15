import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { selectAll } from "@/lib/db";
import { sum, tzs } from "@/lib/money";
import { modules } from "@/lib/modules";
import { useRecordEditor } from "@/components/orbis/RecordEditor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/orbis/AppShell";
import { StatusBadge } from "@/components/orbis/StatusBadge";
import { Stat } from "@/components/orbis/Stat";

export const Route = createFileRoute("/_authenticated/drivers/")({
  head: () => ({
    meta: [
      { title: "Drivers — Orbis Logistics" },
      { name: "description", content: "Driver register with trips completed, salary and payments made." },
      { property: "og:title", content: "Drivers — Orbis Logistics" },
      { property: "og:description", content: "Driver register with trips completed, salary and payments made." },
    ],
  }),
  component: DriversPage,
});

function DriversPage() {
  const [term, setTerm] = useState("");
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["driver-overview"],
    queryFn: async () => {
      const [drivers, trips, payments] = await Promise.all([
        selectAll("drivers"),
        selectAll("trips"),
        selectAll("driver_payments"),
      ]);
      return drivers.map((d: any) => {
        const own = trips.filter((t: any) => String(t.driver_id) === String(d.id));
        const paid = payments.filter((p: any) => String(p.driver_id) === String(d.id));
        return {
          ...d,
          tripCount: own.length,
          km: sum(own, (t: any) => t.planned_distance),
          paid: sum(paid, (p: any) => p.amount_tzs),
        };
      });
    },
  });

  const editor = useRecordEditor(modules.drivers, rows);

  const filtered = rows.filter((r: any) =>
    `${r.full_name ?? ""} ${r.driver_code ?? ""} ${r.phone ?? ""}`.toLowerCase().includes(term.trim().toLowerCase()),
  );

  return (
    <>
      <PageHeader title="Drivers" subtitle="Driver register, trip load and payments" />
      <div className="mb-4">
        <Button onClick={editor.openNew}>New driver</Button>
      </div>
      {editor.dialog}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Total drivers" value={rows.length} />
        <Stat label="On trip" value={rows.filter((r: any) => r.status === "On Trip").length} />
        <Stat label="Payments made" value={tzs(sum(rows, (r: any) => r.paid))} />
      </div>

      <Card className="mt-5 p-3 sm:p-4">
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search name, code or phone…"
          className="mb-3 sm:max-w-sm"
        />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Licence expiry</TableHead>
                <TableHead>Trips</TableHead>
                <TableHead>Total KM</TableHead>
                <TableHead>Salary</TableHead>
                <TableHead>Paid to date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Edit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10}>Loading…</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10}>No drivers yet.</TableCell>
                </TableRow>
              ) : (
                filtered.map((d: any) => (
                  <TableRow key={String(d.id)}>
                    <TableCell className="whitespace-nowrap font-medium">
                      <Link
                        to="/drivers/$driverId"
                        params={{ driverId: String(d.id) }}
                        className="text-primary hover:underline"
                      >
                        {d.full_name}
                      </Link>
                    </TableCell>
                    <TableCell>{d.driver_code ?? "—"}</TableCell>
                    <TableCell>{d.phone ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{String(d.licence_expiry ?? "—").slice(0, 10)}</TableCell>
                    <TableCell>{d.tripCount}</TableCell>
                    <TableCell>{d.km.toLocaleString()}</TableCell>
                    <TableCell className="whitespace-nowrap">{tzs(d.monthly_salary_tzs)}</TableCell>
                    <TableCell className="whitespace-nowrap">{tzs(d.paid)}</TableCell>
                    <TableCell>
                      <StatusBadge value={d.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => editor.openEdit(d)}>
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </>
  );
}
