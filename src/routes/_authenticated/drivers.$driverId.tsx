import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  MapPin,
  Phone,
  Printer,
  Truck,
  Wallet,
} from "lucide-react";

import { selectAll } from "@/lib/db";
import { sum, tzs } from "@/lib/money";
import { modules } from "@/lib/modules";
import { formatValue } from "@/lib/orbis";
import { useRecordEditor } from "@/components/orbis/RecordEditor";
import { DriverDeductionsTab } from "@/components/orbis/DriverDeductionsTab";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  if (!value) return "—";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function daysUntil(value: unknown): number | null {
  if (!value) return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function ExpiryBadge({ days }: { days: number | null }) {
  if (days === null) return <span className="text-muted-foreground">—</span>;
  if (days < 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/5 px-2 py-0.5 text-xs font-medium text-destructive">
        <AlertTriangle className="size-3" /> Expired {Math.abs(days)}d ago
      </span>
    );
  }
  if (days < 90) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/5 px-2 py-0.5 text-xs font-medium text-warning-foreground">
        <AlertTriangle className="size-3" /> {days}d left
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">{days}d left</span>;
}

function scoreTier(score: number): { label: string; tone: string; stars: number } {
  if (score >= 90) return { label: "Excellent", tone: "text-success", stars: 5 };
  if (score >= 75) return { label: "Good", tone: "text-primary", stars: 4 };
  if (score >= 60) return { label: "Fair", tone: "text-warning-foreground", stars: 3 };
  if (score >= 40) return { label: "Needs attention", tone: "text-warning-foreground", stars: 2 };
  if (score >= 20) return { label: "Poor", tone: "text-destructive", stars: 1 };
  return { label: "Critical", tone: "text-destructive", stars: 0 };
}

function RankingCard({
  incidents,
  policeCases,
  overdueDeductions,
}: {
  incidents: any[];
  policeCases: any[];
  overdueDeductions: any[];
}) {
  // Same formula as the SQL function driver_rank_score()
  const incidentPenalty = incidents.reduce((s: number, i: any) => {
    const sev = String(i.severity ?? "");
    const p = sev === "Critical" ? 25 : sev === "High" ? 15 : sev === "Medium" ? 8 : sev === "Low" ? 3 : 5;
    return s + p;
  }, 0);
  const casePenalty = policeCases.length * 10;
  const overduePenalty = overdueDeductions.length * 5;
  const totalPenalty = incidentPenalty + casePenalty + overduePenalty;
  const score = Math.max(0, Math.min(100, 100 - totalPenalty));
  const tier = scoreTier(score);

  const stars = "★".repeat(tier.stars) + "☆".repeat(5 - tier.stars);

  return (
    <Card className="mt-5 p-4">
      <div className="flex items-center gap-2">
        <Award className="size-4 text-primary" />
        <h2 className="font-semibold">Ranking</h2>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Score based on incidents, police cases and overdue deductions (last 12 months)
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex items-baseline gap-2">
          <span className={`text-4xl font-bold ${tier.tone}`}>{score}</span>
          <span className="text-sm text-muted-foreground">/ 100</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-2xl leading-none ${tier.tone}`}>{stars}</span>
          <span className={`text-sm font-medium ${tier.tone}`}>{tier.label}</span>
        </div>
      </div>

      <dl className="mt-4 grid gap-x-6 gap-y-2 border-t pt-3 text-sm sm:grid-cols-2">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">
            Incidents <span className="text-xs">({incidents.length})</span>
          </dt>
          <dd className={incidentPenalty > 0 ? "font-medium text-destructive" : "text-muted-foreground"}>
            −{incidentPenalty}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">
            Police cases <span className="text-xs">({policeCases.length})</span>
          </dt>
          <dd className={casePenalty > 0 ? "font-medium text-destructive" : "text-muted-foreground"}>
            −{casePenalty}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">
            Overdue deductions <span className="text-xs">({overdueDeductions.length})</span>
          </dt>
          <dd className={overduePenalty > 0 ? "font-medium text-destructive" : "text-muted-foreground"}>
            −{overduePenalty}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 font-medium">
          <dt>Total penalty</dt>
          <dd className={totalPenalty > 0 ? "text-destructive" : "text-success"}>
            −{totalPenalty}
          </dd>
        </div>
      </dl>
    </Card>
  );
}

function DriverProfile() {
  const { driverId } = useParams({ from: "/_authenticated/drivers/$driverId" });

  const { data, isLoading } = useQuery({
    queryKey: ["driver-profile", driverId],
    queryFn: async () => {
      const [drivers, trips, payments, vehicles, tripFinancials, tripVehicles, incidents, policeCases, deductions] =
        await Promise.all([
          selectAll("drivers"),
          selectAll("trips"),
          selectAll("driver_payments"),
          selectAll("vehicles"),
          selectAll("trip_financials"),
          selectAll("trip_vehicles"),
          selectAll("incidents"),
          selectAll("police_cases"),
          selectAll("driver_deductions"),
        ]);

      const driver = drivers.find((d: any) => String(d.id) === driverId) ?? null;
      const reg = new Map(vehicles.map((v: any) => [String(v.id), v.registration_number]));
      const finByTrip = new Map(tripFinancials.map((f: any) => [String(f.trip_id), f]));

      const convoyByTrip = new Map<string, any[]>();
      for (const tv of tripVehicles) {
        if (String(tv.driver_id) !== driverId) continue;
        const tid = String(tv.trip_id);
        const list = convoyByTrip.get(tid) ?? [];
        list.push(tv);
        convoyByTrip.set(tid, list);
      }

      const ownTrips = trips
        .filter((t: any) => String(t.driver_id) === driverId || convoyByTrip.has(String(t.id)))
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

      const assignedTruck = driver?.assigned_vehicle_id
        ? reg.get(String(driver.assigned_vehicle_id)) ?? null
        : null;
      const assignedTrailer = driver?.assigned_trailer_id
        ? reg.get(String(driver.assigned_trailer_id)) ?? null
        : null;

      // Ranking inputs (12-month window matches the SQL function)
      const twelveMonthsAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
      const rankIncidents = incidents.filter((i: any) => {
        if (String(i.driver_id) !== driverId) return false;
        if (!i.occurred_at) return true;
        return new Date(String(i.occurred_at)).getTime() >= twelveMonthsAgo;
      });
      const rankCases = policeCases.filter((c: any) => {
        if (String(c.driver_id) !== driverId) return false;
        if (!c.reported_on) return true;
        return new Date(String(c.reported_on)).getTime() >= twelveMonthsAgo;
      });
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const rankOverdue = deductions.filter((d: any) => {
        if (String(d.driver_id) !== driverId) return false;
        if (String(d.status) !== "Pending") return false;
        if (!d.deduction_date) return false;
        return new Date(String(d.deduction_date)).getTime() < thirtyDaysAgo;
      });

      return {
        driver,
        trips: ownTrips,
        payments: ownPayments,
        tripAdvances,
        assignedTruck,
        assignedTrailer,
        rankIncidents,
        rankCases,
        rankOverdue,
      };
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

  const salary = sum(data.payments.filter((p: any) => p.payment_type === "Salary"), (p: any) => p.amount_tzs);
  const extraAdvances = sum(data.payments.filter((p: any) => p.payment_type === "Advance"), (p: any) => p.amount_tzs);
  const bonuses = sum(data.payments.filter((p: any) => p.payment_type === "Bonus"), (p: any) => p.amount_tzs);
  const activeTrips = data.trips.filter((t: any) =>
    ["Dispatched", "In Transit", "In Yard", "At Border"].includes(String(t.status)),
  ).length;
  const primaryCount = data.trips.filter((t: any) => t.isPrimary).length;
  const convoyCount = data.trips.filter((t: any) => t.isConvoyOnly).length;
  const totalAdvances = data.tripAdvances + extraAdvances;

  const ledger = [...data.payments].sort((a: any, b: any) =>
    String(b.payment_date ?? "").localeCompare(String(a.payment_date ?? "")),
  );

  const monthlySalary = Number(d.monthly_salary_tzs ?? 0);

  const licenceDays = daysUntil(d.licence_expiry);
  const passportDays = daysUntil(d.passport_expiry);
  const hasExpiryWarning =
    (licenceDays !== null && licenceDays < 90) || (passportDays !== null && passportDays < 90);

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
        subtitle={[d.driver_code, d.licence_number ? `licence ${d.licence_number}` : null].filter(Boolean).join(" · ") || "—"}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/voucher" search={{ driver: driverId }}>
                <Printer className="size-4" /> Print voucher
              </Link>
            </Button>
            <Button onClick={openRecordPayment}>
              <Wallet className="size-4" /> Record payment
            </Button>
          </>
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
        {data.assignedTruck || data.assignedTrailer ? (
          <span className="inline-flex items-center gap-1.5">
            <Truck className="size-3.5" />
            <span className="text-xs font-semibold uppercase tracking-wide">Assigned</span>
            {data.assignedTruck ? <span>{data.assignedTruck}</span> : null}
            {data.assignedTrailer ? <span>+ {data.assignedTrailer}</span> : null}
          </span>
        ) : null}
        {hasExpiryWarning ? (
          <span className="inline-flex items-center gap-1 text-warning-foreground">
            <AlertTriangle className="size-3.5" /> Document expiring soon
          </span>
        ) : null}
        <StatusBadge value={d.status} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Trips"
          value={data.trips.length}
          sub={convoyCount > 0 ? `${primaryCount} primary · ${convoyCount} convoy · ${activeTrips} active` : `${activeTrips} active`}
        />
        <Stat label="Trip advances" value={tzs(data.tripAdvances)} sub="Paid on dispatch" tone="amber" />
        <Stat label="Extra advances" value={tzs(extraAdvances)} sub="Outside contracts" />
        <Stat
          label="Salary paid"
          value={tzs(salary)}
          sub={monthlySalary > 0 ? `Monthly ${tzs(monthlySalary)}` : `${data.payments.length} payment${data.payments.length === 1 ? "" : "s"}`}
          tone="green"
        />
      </div>

      <RankingCard
        incidents={data.rankIncidents}
        policeCases={data.rankCases}
        overdueDeductions={data.rankOverdue}
      />

      <Tabs defaultValue="details" className="mt-6">
        <div className="overflow-x-auto">
          <TabsList className="w-max">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="trips">
              Trips {data.trips.length > 0 ? <span className="ml-1.5 text-xs opacity-70">{data.trips.length}</span> : null}
            </TabsTrigger>
            <TabsTrigger value="payments">
              Payments {data.payments.length > 0 ? <span className="ml-1.5 text-xs opacity-70">{data.payments.length}</span> : null}
            </TabsTrigger>
            <TabsTrigger value="deductions">Deductions</TabsTrigger>
            <TabsTrigger value="documents">
              Documents {hasExpiryWarning ? <span className="ml-1.5 inline-block size-2 rounded-full bg-destructive" /> : null}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* DETAILS */}
        <TabsContent value="details" className="mt-4">
          <Card className="overflow-hidden">
            <div className="border-b px-4 py-3">
              <h2 className="font-semibold">Driver details</h2>
              <p className="text-sm text-muted-foreground">Complete information for this driver.</p>
            </div>
            <dl className="grid sm:grid-cols-2 xl:grid-cols-3">
              {(
                [
                  ["full_name", "Full name"],
                  ["driver_code", "Driver code"],
                  ["phone", "Phone"],
                  ["base_location", "Base location"],
                  ["status", "Status"],
                  ["monthly_salary_tzs", "Monthly salary (TZS)"],
                ] as [string, string][]
              ).map(([key, label]) => (
                <div key={key} className="min-w-0 border-b p-4 sm:border-r">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
                  <dd className="mt-1 break-words text-sm font-medium">
                    {key === "status" ? (
                      <StatusBadge value={String(d[key] ?? "")} />
                    ) : key === "monthly_salary_tzs" ? (
                      tzs(d[key])
                    ) : (
                      formatValue(d[key])
                    )}
                  </dd>
                </div>
              ))}
              <div className="min-w-0 border-b p-4 sm:border-r">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Assigned truck</dt>
                <dd className="mt-1 text-sm font-medium">
                  {data.assignedTruck ? <span>{data.assignedTruck}</span> : <span className="text-muted-foreground">Not assigned</span>}
                </dd>
              </div>
              <div className="min-w-0 border-b p-4 sm:border-r">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Assigned trailer</dt>
                <dd className="mt-1 text-sm font-medium">
                  {data.assignedTrailer ? <span>{data.assignedTrailer}</span> : <span className="text-muted-foreground">Not assigned</span>}
                </dd>
              </div>
              {d.notes ? (
                <div className="min-w-0 border-b p-4 sm:col-span-2 xl:col-span-3">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Notes</dt>
                  <dd className="mt-1 whitespace-pre-wrap text-sm">{String(d.notes)}</dd>
                </div>
              ) : null}
            </dl>
          </Card>
        </TabsContent>

        {/* TRIPS */}
        <TabsContent value="trips" className="mt-4">
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
        </TabsContent>

        {/* PAYMENTS */}
        <TabsContent value="payments" className="mt-4">
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
                    <TableHead>Period</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5}>No payments recorded.</TableCell>
                    </TableRow>
                  ) : (
                    ledger.map((p: any) => (
                      <TableRow key={String(p.id)}>
                        <TableCell className="whitespace-nowrap">{formatDate(p.payment_date)}</TableCell>
                        <TableCell>
                          <StatusBadge value={p.payment_type} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">{p.period_label ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{p.notes ?? "—"}</TableCell>
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
        </TabsContent>

        {/* DEDUCTIONS */}
        <TabsContent value="deductions" className="mt-4">
          <DriverDeductionsTab driverId={driverId} advances={totalAdvances} />
        </TabsContent>

        {/* DOCUMENTS */}
        <TabsContent value="documents" className="mt-4">
          <Card className="overflow-hidden">
            <div className="border-b px-4 py-3">
              <h2 className="font-semibold">Documents</h2>
              <p className="text-sm text-muted-foreground">
                Licences, passports and expiry warnings.
              </p>
            </div>
            <dl className="grid sm:grid-cols-2 xl:grid-cols-3">
              <div className="min-w-0 border-b p-4 sm:border-r">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Licence number</dt>
                <dd className="mt-1 text-sm font-medium">{String(d.licence_number ?? "—")}</dd>
              </div>
              <div className="min-w-0 border-b p-4 sm:border-r">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Licence expiry</dt>
                <dd className="mt-1 flex items-center gap-2 text-sm font-medium">
                  <span>{formatDate(d.licence_expiry)}</span>
                  <ExpiryBadge days={licenceDays} />
                </dd>
              </div>
              <div className="min-w-0 border-b p-4">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Passport number</dt>
                <dd className="mt-1 text-sm font-medium">{String(d.passport_number ?? "—")}</dd>
              </div>
              <div className="min-w-0 border-b p-4 sm:border-r">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Passport expiry</dt>
                <dd className="mt-1 flex items-center gap-2 text-sm font-medium">
                  <span>{formatDate(d.passport_expiry)}</span>
                  <ExpiryBadge days={passportDays} />
                </dd>
              </div>
            </dl>
          </Card>
        </TabsContent>
      </Tabs>

      {paymentEditor.dialog}
    </>
  );
}
