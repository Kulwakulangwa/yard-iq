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
      { name: "description", content: "Driver register with trips completed, salary, licence and passport expiry." },
      { property: "og:title", content: "Drivers — Orbis Logistics" },
      { property: "og:description", content: "Driver register with trips completed, salary, licence and passport expiry." },
    ],
  }),
  component: DriversPage,
});

function daysUntil(value: unknown): number | null {
  if (!value) return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function formatDate(value: unknown) {
  if (!value) return "—";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Licence expiry cell — red when expired or ≤ 60 days remain. */
function LicenceExpiryCell({ value }: { value: unknown }) {
  const days = daysUntil(value);

  if (days === null) {
    return <span className="text-muted-foreground">—</span>;
  }

  // Expired
  if (days < 0) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="whitespace-nowrap font-medium text-destructive">
          {formatDate(value)}
        </span>
        <span className="inline-flex w-fit items-center rounded-full border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
          Expired {Math.abs(days)}d ago
        </span>
      </div>
    );
  }

  // 60 days or less — red (2 months warning)
  if (days <= 60) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="whitespace-nowrap font-medium text-destructive">
          {formatDate(value)}
        </span>
        <span className="inline-flex w-fit items-center rounded-full border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
          {days}d left
        </span>
      </div>
    );
  }

  // More than 60 days — neutral
  return (
    <span className="whitespace-nowrap text-muted-foreground">
      {formatDate(value)}
    </span>
  );
}

/** Passport expiry cell — red when expired or ≤ 30 days remain, amber up to 90. */
function PassportExpiryCell({ value }: { value: unknown }) {
  const days = daysUntil(value);

  if (days === null) {
    return <span className="text-muted-foreground">—</span>;
  }

  if (days < 0) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="whitespace-nowrap font-medium text-destructive">
          {formatDate(value)}
        </span>
        <span className="inline-flex w-fit items-center rounded-full border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
          Expired {Math.abs(days)}d ago
        </span>
      </div>
    );
  }

  if (days <= 30) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="whitespace-nowrap font-medium text-destructive">
          {formatDate(value)}
        </span>
        <span className="inline-flex w-fit items-center rounded-full border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
          {days}d left
        </span>
      </div>
    );
  }

  if (days <= 90) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="whitespace-nowrap font-medium text-warning-foreground">
          {formatDate(value)}
        </span>
        <span className="inline-flex w-fit items-center rounded-full border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning-foreground">
          {days}d left
        </span>
      </div>
    );
  }

  return (
    <span className="whitespace-nowrap text-muted-foreground">
      {formatDate(value)}
    </span>
  );
}

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
    `${r.full_name ?? ""} ${r.driver_code ?? ""} ${r.phone ?? ""}`
      .toLowerCase()
      .includes(term.trim().toLowerCase()),
  );

  return (
    <>
      <PageHeader title="Drivers" subtitle="Driver register, trip load and document status" />
      <div className="mb-4">
        <Button onClick={() => editor.openNew()}>New driver</Button>
      </div>
      {editor.dialog}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Total drivers" value={rows.length} />
        <Stat label="On trip" value={rows.filter((r: any) => r.status === "On Trip").length} />
        <Stat
          label="Documents expiring"
          value={rows.filter((r: any) => {
            const lic = daysUntil(r.licence_expiry);
            const p = daysUntil(r.passport_expiry);
            return (lic !== null && lic <= 60) || (p !== null && p <= 90);
          }).length}
          tone="amber"
        />
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
                <TableHead>Passport expiry</TableHead>
                <TableHead>Trips</TableHead>
                <TableHead>Total KM</TableHead>
                <TableHead>Salary</TableHead>
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
                    <TableCell>
                      <LicenceExpiryCell value={d.licence_expiry} />
                    </TableCell>
                    <TableCell>
                      <PassportExpiryCell value={d.passport_expiry} />
                    </TableCell>
                    <TableCell>{d.tripCount}</TableCell>
                    <TableCell>{d.km.toLocaleString()}</TableCell>
                    <TableCell className="whitespace-nowrap">{tzs(d.monthly_salary_tzs)}</TableCell>
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
