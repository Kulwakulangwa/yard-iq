import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { selectAll } from "@/lib/db";
import { sum, tzs } from "@/lib/money";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/orbis/AppShell";
import { StatusBadge } from "@/components/orbis/StatusBadge";
import { Stat } from "@/components/orbis/Stat";

export const Route = createFileRoute("/_authenticated/technicians")({
  head: () => ({
    meta: [
      { title: "Technicians — Orbis Logistics" },
      { name: "description", content: "Workshop technicians with jobs done, billed cost and outstanding balance." },
      { property: "og:title", content: "Technicians — Orbis Logistics" },
      { property: "og:description", content: "Workshop technicians with jobs done, billed cost and outstanding balance." },
    ],
  }),
  component: TechniciansPage,
});

function TechniciansPage() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["technician-overview"],
    queryFn: async () => {
      const [technicians, maintenance] = await Promise.all([
        selectAll("technicians"),
        selectAll("vehicle_maintenance"),
      ]);
      return technicians.map((t: any) => {
        const jobs = maintenance.filter((m: any) => String(m.technician_id) === String(t.id));
        const billed = sum(jobs, (m: any) => m.cost_tzs);
        const paid = sum(jobs, (m: any) => m.paid_amount);
        return { ...t, jobs: jobs.length, billed, paid, balance: billed - paid };
      });
    },
  });

  return (
    <>
      <PageHeader title="Technicians" subtitle="Workshop staff, jobs completed and payment balances" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Technicians" value={rows.length} />
        <Stat label="Total billed" value={tzs(sum(rows, (r: any) => r.billed))} />
        <Stat label="Outstanding" value={tzs(sum(rows, (r: any) => r.balance))} tone="amber" />
      </div>

      <Card className="mt-5 p-3 sm:p-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Speciality</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Jobs</TableHead>
                <TableHead>Billed</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8}>Loading…</TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>No technicians yet.</TableCell>
                </TableRow>
              ) : (
                rows.map((t: any) => (
                  <TableRow key={String(t.id)}>
                    <TableCell className="whitespace-nowrap font-medium">{t.full_name}</TableCell>
                    <TableCell>{t.speciality ?? "—"}</TableCell>
                    <TableCell>{t.phone ?? "—"}</TableCell>
                    <TableCell>{t.jobs}</TableCell>
                    <TableCell className="whitespace-nowrap">{tzs(t.billed)}</TableCell>
                    <TableCell className="whitespace-nowrap">{tzs(t.paid)}</TableCell>
                    <TableCell className="whitespace-nowrap">{tzs(t.balance)}</TableCell>
                    <TableCell>
                      <StatusBadge value={t.status} />
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
