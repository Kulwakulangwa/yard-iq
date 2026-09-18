import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, MapPin, Phone, Wallet } from "lucide-react";

import { selectAll } from "@/lib/db";
import { sum, tzs } from "@/lib/money";
import { modules } from "@/lib/modules";
import { useRecordEditor } from "@/components/orbis/RecordEditor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/orbis/AppShell";
import { StatusBadge } from "@/components/orbis/StatusBadge";
import { Stat } from "@/components/orbis/Stat";

export const Route = createFileRoute("/_authenticated/drivers/$driverId")({
  head: () => ({
    meta: [
      { title: "Driver Profile — Orbis Logistics" },
      { name: "description", content: "Driver profile with trips, advances, salary and payment ledger." },
      { property: "og:title", content: "Driver Profile — Orbis Logistics" },
      { property: "og:description", content: "Driver profile with trips, advances, salary and payment ledger." },
    ],
  }),
  component: DriverProfile,
});

function formatDate(value: unknown) {
  if (!value) return "";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function daysUntil(value: unknown): number | null {
  if (!value) return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  const diff = d.getTime() - Date.now();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function PassportChip({
  number,
  expiry,
}: {
  number: string | null | undefined;
  expiry: string | null | undefined;
}) {
  if (!number && !expiry) return null;

  const days = daysUntil(expiry);
  const tone =
    days === null
      ? "text-muted-foreground"
      : days < 0
        ? "text-destructive"
        : days < 90
          ? "text-warning-foreground"
          : "text-muted-foreground";

  const hint =
    days === null
      ? ""
      : days < 0
        ? ` — expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`
        : days < 90
          ? ` — expires in ${days} day${days === 1 ? "" : "s"}`
          : "";

  return (
    <span className={`inline-flex items-center gap-1.5 ${tone}`}>
      <span className="text-xs font-semibold uppercase tracking-wide">Passport</span>
      {number ? <span>{number}</span> : null}
      {expiry ? (
        <span>
          · expires {formatDate(expiry)}
          {hint}
        </span>
      ) : null}
      {days !== null && days < 90 ? <AlertTriangle className="size-3.5" /> : null}
    </span>
  );
}

function DriverProfile() {
  const { driverId } = useParams({ from: "/_authenticated/drivers/$driverId" });

  const { data, isLoading } = useQuery({
    queryKey: ["driver-profile", driverId],
    queryFn: async () => {
      const [drivers, trips, payments, vehicles, tripFinancials, tripVehicles] = await Promise.all([
        selectAll("drivers"),
        selectAll("trips"),
        selectAll("driver_payments"),
        selectAll("vehicles"),
        selectAll("trip_financials"),
        selectAll("trip_vehicles"),
      ]);

      const driver = drivers.find((d: any) => String(d.id) === driverId) ?? null;
      const reg = new Map(vehicles.map((v: any) => [String(v.id), v.registration_number]));
      const finByTrip = new Map(tripFinancials.map((f: any) => [String(f.trip_id), f]));

      // Trips where this driver is a convoy leg
      const convoyByTrip = new Map<string, any[]>();
      for (const tv of tripVehicles) {
        if (String(tv.driver_id) !== driverId) continue;
        const tid = String(tv.trip_id);
        const list = convoyByTrip.get(tid) ?? [];
        list.push(tv);
        convoyByTrip.set(tid, list);
      }

      const ownTrips = trips
        .filter(
          (t: any) => String(t.driver_id) === driverId || convoyByTrip.has(String(t.id)),
        )
        .map((t: any) => {
          const isPrimary = String(t.driver_id) === driverId;
          const convoyLegs = convoyByTrip.get(String(t.id)) ?? [];
          const convoyVehicles = convoyLegs
            .map((leg: any) => reg.get(String(leg.vehicle_id)) ?? "—")
            .filter((x: string) => x !== "—");
          return {
            ...t,
            isPrimary,
            isConvoyOnly: !isPrimary && convoyLegs.length > 0,
            convoyVehicle: convoyVehicles.join(", "),
            vehicle: reg.get(String(t.vehicle_id)) ?? "—",
            advance: isPrimary ? Number(finByTrip.get(String(t.id))?.advance_paid_tzs ?? 0) : 0,
          };
        });

      const tripAdvances = ownTrips.reduce((s: number, t: any) => s + t.advance, 0);
      const ownPayments = payments.filter((p: any) => String(p.driver_id) === driverId);

      return { driver, trips: ownTrips, payments: ownPayments, tripAdvances };
    },
  });

  const paymentRows = data?.payments ?? [];
  const paymentEditor = useRecordEditor(modules.driver_payments, paymentRows);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading driver…</p>;
  if (!data?.driver) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <h1 className="text-lg font-semibold">Driver not found</h1>
        <Link to="/drivers" className="mt-2 inline-block text-sm text-primary hover:underline">
          Back to drivers
        </Link>
      </div>
    );
  }

  const d: any = data.driver;

  const salary = sum(
    data.payments.filter((p: any) => p.payment_type === "Salary"),
    (p: any) => p.amount_tzs,
  );
  const extraAdvances = sum(
    data.payments.filter((p: any) => p.payment_type === "Advance"),
    (p: any) => p.amount_tzs,
  );
  const bonuses = sum(
    data.payments.filter((p: any) => p.payment_type === "Bonus"),
    (p: any) => p.amount_tzs,
  );
  const activeTrips = data.trips.filter((t: any) =>
    ["Dispatched", "In Transit", "In Yard"].includes(String(t.status)),
  ).length;
  const primaryCount = data.trips.filter((t: any) => t.isPrimary).length;
  const convoyCount = data.trips.filter((t: any) => t.isConvoyOnly).length;

  const ledger = [...data.payments].sort((a: any, b: any) =>
    String(b.payment_date ?? "").localeCompare(String(a.payment_date ?? "")),
  );

  const monthlySalary = Number(d.monthly_salary_tzs ?? 0);

  function openRecordPayment() {
    paymentEditor.openNew({
      driver_id: driverId,
      payment_date: new Date().toISOString().slice(0, 10),
      payment_type: "Salary",
    });
  }

  return (
    <>
      <Link
        to="/drivers"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All drivers
      </Link>

      <PageHeader
        title={String(d.full_name ?? "Driver")}
        subtitle={
          [d.driver_code, d.licence_number ? `licence ${d.licence_number}` : null]
            .filter(Boolean)
            .join(" · ") || "—"
        }
        actions={
          <Button onClick={openRecordPayment}>
            <Wallet className="size-4" /> Record payment
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
        {d.phone ? (
          <span className="inline-flex items-center gap-1.5">
            <Phone className="size-3.5" /> {String(d.phone)}
          </span>
        ) : null}
        {d.base_location ? (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-3.5" /> {String(d.base_location)}
          </span>
        ) : null}
        <PassportChip number={d.passport_number} expiry={d.passport_expiry} />
        <StatusBadge value={d.status} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Trips"
          value={data.trips.length}
          sub={
            convoyCount > 0
              ? `${primaryCount} primary · ${convoyCount} convoy · ${activeTrips} active`
              : `${activeTrips} active`
          }
        />
        <Stat
          label="Trip advances"
          value={tzs(data.tripAdvances)}
          sub="Paid on dispatch"
          tone="amber"
        />
        <Stat
          label="Extra advances"
          value={tzs(extraAdvances)}
          sub="Outside contracts"
        />
        <Stat
          label="Salary paid"
          value={tzs(salary)}
          sub={
            monthlySalary > 0
              ? `Monthly ${tzs(monthlySalary)}`
              : `${data.payments.length} payment${data.payments.length === 1 ? "" : "s"}`
          }
          tone="green"
        />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold">Trips driven</h2>
            <p className="text-sm text-muted-foreground">
              Trips where this driver is primary or on a convoy leg.
            </p>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trip</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Advance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.trips.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4}>No trips recorded.</TableCell>
                  </TableRow>
                ) : (
                  data.trips.map((t: any) => (
                    <TableRow key={String(t.id)}>
                      <TableCell className="whitespace-nowrap font-medium">
                        <div className="flex flex-wrap items-center gap-2">
                          {t.trip_number ?? "—"}
                          {t.isConvoyOnly ? (
                            <span className="rounded-full border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                              Convoy
                            </span>
                          ) : null}
                        </div>
                        <div className="text-xs font-normal text-muted-foreground">
                          {t.isConvoyOnly && t.convoyVehicle ? t.convoyVehicle : t.vehicle}
                        </div>
                      </TableCell>
                      <TableCell className="min-w-0">
                        <div className="truncate">
                          {t.origin ?? "—"} → {t.destination ?? "—"}
                        </div>
                        {t.planned_distance ? (
                          <div className="text-xs text-muted-foreground">
                            {Number(t.planned_distance).toLocaleString()} km
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <StatusBadge value={t.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right font-medium">
                        {t.advance > 0 ? tzs(t.advance) : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
            <div>
              <h2 className="font-semibold">Payment ledger</h2>
              <p className="text-sm text-muted-foreground">
                {data.payments.length} entr{data.payments.length === 1 ? "y" : "ies"}
                {bonuses > 0 ? ` · ${tzs(bonuses)} bonus` : ""}
              </p>
            </div>
            <Button size="sm" onClick={openRecordPayment}>
              <Wallet className="size-4" /> Record payment
            </Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3}>No payments recorded.</TableCell>
                  </TableRow>
                ) : (
                  ledger.map((p: any) => (
                    <TableRow key={String(p.id)}>
                      <TableCell className="whitespace-nowrap">
                        {String(p.payment_date ?? "—").slice(0, 10)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge value={p.payment_type} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right font-medium">
                        {tzs(p.amount_tzs)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {paymentEditor.dialog}
    </>
  );
}
