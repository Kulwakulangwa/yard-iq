import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Link2, Plus } from "lucide-react";

import { selectAll } from "@/lib/db";
import { sum, tzs } from "@/lib/money";
import { modules } from "@/lib/modules";
import { formatValue } from "@/lib/orbis";
import { useRecordEditor } from "@/components/orbis/RecordEditor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/orbis/AppShell";
import { StatusBadge } from "@/components/orbis/StatusBadge";
import { Stat } from "@/components/orbis/Stat";

export const Route = createFileRoute("/_authenticated/trailers/$trailerId")({
  head: () => ({
    meta: [
      { title: "Trailer Profile — Orbis Logistics" },
      { name: "description", content: "Full trailer profile: trips, coupling history, maintenance, inspections and tires." },
      { property: "og:title", content: "Trailer Profile — Orbis Logistics" },
      { property: "og:description", content: "Full trailer profile: trips, coupling history, maintenance, inspections and tires." },
    ],
  }),
  component: TrailerProfile,
});

function TrailerProfile() {
  const { trailerId } = useParams({ from: "/_authenticated/trailers/$trailerId" });

  const { data, isLoading } = useQuery({
    queryKey: ["trailer-profile", trailerId],
    queryFn: async () => {
      const [
        vehicles,
        trips,
        financials,
        maintenance,
        workOrders,
        inspections,
        tires,
        tireMovements,
        drivers,
        technicians,
        tripVehicles,
      ] = await Promise.all([
        selectAll("vehicles"),
        selectAll("trips"),
        selectAll("trip_financials"),
        selectAll("vehicle_maintenance"),
        selectAll("work_orders"),
        selectAll("vehicle_inspections"),
        selectAll("tires"),
        selectAll("tire_movements"),
        selectAll("drivers"),
        selectAll("technicians"),
        selectAll("trip_vehicles"),
      ]);

      const trailer = vehicles.find((v: any) => String(v.id) === trailerId) ?? null;
      const finByTrip = new Map(financials.map((f: any) => [f.trip_id, f]));
      const driverName = new Map(drivers.map((d: any) => [String(d.id), d.full_name]));
      const techName = new Map(technicians.map((t: any) => [String(t.id), t.full_name]));
      const tripNum = new Map(trips.map((t: any) => [String(t.id), t.trip_number]));
      const vehicleReg = new Map(
        vehicles.map((v: any) => [String(v.id), String(v.registration_number ?? "")]),
      );

      const couples = tripVehicles
        .filter((tv: any) => String(tv.trailer_id) === trailerId)
        .map((tv: any) => ({
          ...tv,
          vehicleReg: vehicleReg.get(String(tv.vehicle_id)) ?? "—",
          driverName: driverName.get(String(tv.driver_id)) ?? "—",
          tripNumber: tripNum.get(String(tv.trip_id)) ?? "—",
          trip: trips.find((t: any) => String(t.id) === String(tv.trip_id)) ?? null,
        }))
        .sort((a: any, b: any) =>
          String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")),
        );

      const tripIds = new Set(couples.map((c: any) => String(c.trip_id)));
      const ownTrips = trips
        .filter((t: any) => tripIds.has(String(t.id)))
        .map((t: any) => ({
          ...t,
          driverName: driverName.get(String(t.driver_id)) ?? "—",
          revenue: Number(finByTrip.get(t.id)?.total_contract_tzs ?? 0),
        }));

      // Current coupled truck (from vehicles.coupled_to_id)
      const coupledTruck = trailer?.coupled_to_id
        ? vehicles.find((x: any) => String(x.id) === String(trailer.coupled_to_id)) ?? null
        : null;

      return {
        trailer,
        coupledTruck,
        trips: ownTrips,
        couples,
        maintenance: maintenance.filter((m: any) => String(m.vehicle_id) === trailerId),
        workOrders: workOrders.filter((w: any) => String(w.vehicle_id) === trailerId),
        inspections: inspections.filter((i: any) => String(i.vehicle_id) === trailerId),
        tires: tires.filter((t: any) => String(t.vehicle_id) === trailerId),
        tireMovements: tireMovements.filter((tm: any) => String(tm.vehicle_id) === trailerId),
        tripNum,
        techName,
      };
    },
  });

  const maintRows = data?.maintenance ?? [];
  const maintenanceEditor = useRecordEditor(modules.vehicle_maintenance, maintRows);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading trailer…</p>;
  if (!data?.trailer) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <h1 className="text-lg font-semibold">Trailer not found</h1>
        <Link to="/trailers" className="mt-2 inline-block text-sm text-primary hover:underline">
          Back to trailers
        </Link>
      </div>
    );
  }

  const v: any = data.trailer;
  const km = sum(data.trips, (t: any) => t.planned_distance);
  const maintCost = sum(data.maintenance, (j: any) => j.cost_tzs);
  const maintTabCount = data.maintenance.length + data.workOrders.length;
  const lastCouple = data.couples[0];

  function openNewMaintenance() {
    maintenanceEditor.openNew({
      vehicle_id: trailerId,
      maintenance_date: new Date().toISOString().slice(0, 10),
    });
  }

  return (
    <>
      <Link
        to="/trailers"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All trailers
      </Link>

      <PageHeader
        title={String(v.registration_number ?? "Trailer")}
        subtitle={`${v.vehicle_type ?? "Trailer"} · ${v.capacity ?? "—"} capacity`}
        actions={
          <Button variant="outline" onClick={openNewMaintenance}>
            <Plus className="size-4" /> New maintenance
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <StatusBadge value={v.status} />
        {data.coupledTruck ? (
          <span className="inline-flex items-center gap-1.5 text-sm">
            <Link2 className="size-4 text-primary" />
            <span className="text-muted-foreground">Coupled to truck</span>
            <Link
              to="/vehicles/$vehicleId"
              params={{ vehicleId: String(data.coupledTruck.id) }}
              className="font-medium text-primary hover:underline"
            >
              {data.coupledTruck.registration_number}
            </Link>
          </span>
        ) : lastCouple ? (
          <span className="text-sm text-muted-foreground">
            Free · last coupled to <strong className="text-foreground">{lastCouple.vehicleReg}</strong> on{" "}
            <strong className="text-foreground">{lastCouple.tripNumber}</strong>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Link2 className="size-4" />
            Never coupled to a truck
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Trips towed" value={data.trips.length} sub="Assigned to this trailer" />
        <Stat label="Total KM" value={km.toLocaleString()} sub="Sum of trip distances" />
        <Stat
          label="Maintenance cost"
          value={tzs(maintCost)}
          sub={`${data.maintenance.length} record${data.maintenance.length === 1 ? "" : "s"}`}
          tone="amber"
        />
        <Stat
          label="Trucks coupled"
          value={new Set(data.couples.map((c: any) => c.vehicleReg)).size}
          sub="Distinct trucks over time"
        />
      </div>

      <Tabs defaultValue="details" className="mt-6">
        <div className="overflow-x-auto">
          <TabsList className="w-max">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="coupling">
              Coupling {data.couples.length > 0 ? <span className="ml-1.5 text-xs opacity-70">{data.couples.length}</span> : null}
            </TabsTrigger>
            <TabsTrigger value="trips">
              Trips {data.trips.length > 0 ? <span className="ml-1.5 text-xs opacity-70">{data.trips.length}</span> : null}
            </TabsTrigger>
            <TabsTrigger value="maintenance">
              Maintenance {maintTabCount > 0 ? <span className="ml-1.5 text-xs opacity-70">{maintTabCount}</span> : null}
            </TabsTrigger>
            <TabsTrigger value="inspections">
              Inspections {data.inspections.length > 0 ? <span className="ml-1.5 text-xs opacity-70">{data.inspections.length}</span> : null}
            </TabsTrigger>
            <TabsTrigger value="tires">
              Tires {data.tires.length > 0 ? <span className="ml-1.5 text-xs opacity-70">{data.tires.length}</span> : null}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="details" className="mt-4">
          <Card className="overflow-hidden">
            <div className="border-b px-4 py-3">
              <h2 className="font-semibold">Trailer details</h2>
              <p className="text-sm text-muted-foreground">Complete information for this trailer.</p>
            </div>
            <dl className="grid sm:grid-cols-2 xl:grid-cols-3">
              {(
                [
                  ["registration_number", "Registration"],
                  ["vehicle_type", "Type"],
                  ["capacity", "Capacity"],
                  ["status", "Status"],
                  ["yard_zone", "Yard zone"],
                  ["documents_expiry", "Documents expiry"],
                ] as [string, string][]
              ).map(([key, label]) => (
                <div key={key} className="min-w-0 border-b p-4 sm:border-r">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
                  <dd className="mt-1 break-words text-sm font-medium">
                    {key === "status" ? (
                      <StatusBadge value={String(v[key] ?? "")} />
                    ) : (
                      formatValue(v[key])
                    )}
                  </dd>
                </div>
              ))}
              <div className="min-w-0 border-b p-4 sm:border-r">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Coupled truck</dt>
                <dd className="mt-1 text-sm font-medium">
                  {data.coupledTruck ? (
                    <Link
                      to="/vehicles/$vehicleId"
                      params={{ vehicleId: String(data.coupledTruck.id) }}
                      className="text-primary hover:underline"
                    >
                      {data.coupledTruck.registration_number}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">Not coupled</span>
                  )}
                </dd>
              </div>
              {v.notes ? (
                <div className="min-w-0 border-b p-4 sm:col-span-2 xl:col-span-3">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Notes</dt>
                  <dd className="mt-1 whitespace-pre-wrap text-sm">{String(v.notes)}</dd>
                </div>
              ) : null}
            </dl>
          </Card>
        </TabsContent>

        <TabsContent value="coupling" className="mt-4">
          <Card className="overflow-hidden">
            <div className="border-b px-4 py-3">
              <h2 className="font-semibold">Coupling history</h2>
              <p className="text-sm text-muted-foreground">
                Every truck this trailer has been attached to, newest first.
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trip</TableHead>
                    <TableHead>Truck</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.couples.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6}>No coupling history yet.</TableCell>
                    </TableRow>
                  ) : (
                    data.couples.map((c: any) => (
                      <TableRow key={String(c.id)}>
                        <TableCell className="whitespace-nowrap font-medium">{c.tripNumber}</TableCell>
                        <TableCell className="whitespace-nowrap">{c.vehicleReg}</TableCell>
                        <TableCell>{c.driverName}</TableCell>
                        <TableCell>
                          <span className="rounded-full border px-2 py-0.5 text-xs">
                            {c.role ?? "—"}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {c.trip ? `${c.trip.origin ?? "—"} → ${c.trip.destination ?? "—"}` : "—"}
                        </TableCell>
                        <TableCell>
                          {c.trip ? <StatusBadge value={c.trip.status} /> : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="trips" className="mt-4">
          <Card className="overflow-hidden">
            <div className="border-b px-4 py-3">
              <h2 className="font-semibold">Trip history</h2>
              <p className="text-sm text-muted-foreground">All trips this trailer has been towed on.</p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trip</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Departure</TableHead>
                    <TableHead>KM</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.trips.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6}>No trips recorded.</TableCell>
                    </TableRow>
                  ) : (
                    data.trips.map((t: any) => (
                      <TableRow key={String(t.id)}>
                        <TableCell className="whitespace-nowrap font-medium">{t.trip_number ?? "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {t.origin ?? "—"} → {t.destination ?? "—"}
                        </TableCell>
                        <TableCell>{t.driverName}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {String(t.planned_departure ?? "—").slice(0, 16)}
                        </TableCell>
                        <TableCell>{Number(t.planned_distance ?? 0).toLocaleString()}</TableCell>
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
        </TabsContent>

        <TabsContent value="maintenance" className="mt-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {data.maintenance.length} record{data.maintenance.length === 1 ? "" : "s"}
              {data.workOrders.length > 0 ? ` · ${data.workOrders.length} work order${data.workOrders.length === 1 ? "" : "s"}` : ""}
              {" · "}
              <span className="font-medium text-foreground">Total {tzs(maintCost)}</span>
            </p>
            <Button size="sm" onClick={openNewMaintenance}>
              <Plus className="size-4" /> New maintenance
            </Button>
          </div>

          <Card className="overflow-hidden">
            <div className="border-b px-4 py-3">
              <h2 className="font-semibold">Maintenance history</h2>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.maintenance.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6}>No maintenance recorded.</TableCell>
                    </TableRow>
                  ) : (
                    data.maintenance.map((j: any) => (
                      <TableRow key={String(j.id)}>
                        <TableCell className="whitespace-nowrap">
                          {String(j.maintenance_date ?? "—").slice(0, 10)}
                        </TableCell>
                        <TableCell>{j.description ?? "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">{tzs(j.cost_tzs)}</TableCell>
                        <TableCell className="whitespace-nowrap">{tzs(j.paid_amount)}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {tzs(Number(j.cost_tzs ?? 0) - Number(j.paid_amount ?? 0))}
                        </TableCell>
                        <TableCell>
                          <StatusBadge value={j.status} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>

          {data.workOrders.length > 0 ? (
            <Card className="mt-4 overflow-hidden">
              <div className="border-b px-4 py-3">
                <h2 className="font-semibold">Work orders</h2>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>WO #</TableHead>
                      <TableHead>Defect</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Cost est.</TableHead>
                      <TableHead>Actual</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.workOrders.map((w: any) => (
                      <TableRow key={String(w.id)}>
                        <TableCell className="whitespace-nowrap font-medium">
                          {w.work_order_number ?? "—"}
                        </TableCell>
                        <TableCell className="max-w-md truncate">{w.reported_defect ?? "—"}</TableCell>
                        <TableCell>
                          <StatusBadge value={w.priority} />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{tzs(w.cost_estimate)}</TableCell>
                        <TableCell className="whitespace-nowrap">{tzs(w.actual_cost)}</TableCell>
                        <TableCell>
                          <StatusBadge value={w.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="inspections" className="mt-4">
          <Card className="overflow-hidden">
            <div className="border-b px-4 py-3">
              <h2 className="font-semibold">Vehicle inspections</h2>
              <p className="text-sm text-muted-foreground">
                Gate, pre-trip, post-trip and workshop inspections.
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Inspector</TableHead>
                    <TableHead>Findings</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.inspections.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5}>No inspections recorded.</TableCell>
                    </TableRow>
                  ) : (
                    data.inspections.map((i: any) => (
                      <TableRow key={String(i.id)}>
                        <TableCell className="whitespace-nowrap">
                          {String(i.inspected_at ?? "—").slice(0, 16)}
                        </TableCell>
                        <TableCell>{i.inspection_type ?? "—"}</TableCell>
                        <TableCell>
                          <StatusBadge value={i.result} />
                        </TableCell>
                        <TableCell>{i.inspector ?? "—"}</TableCell>
                        <TableCell className="max-w-md truncate">{i.findings ?? "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="tires" className="mt-4">
          <Card className="overflow-hidden">
            <div className="border-b px-4 py-3">
              <h2 className="font-semibold">Currently installed tires</h2>
              <p className="text-sm text-muted-foreground">
                Tires whose current vehicle is this trailer.
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Serial</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.tires.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6}>No tires currently installed.</TableCell>
                    </TableRow>
                  ) : (
                    data.tires.map((t: any) => (
                      <TableRow key={String(t.id)}>
                        <TableCell className="whitespace-nowrap font-medium">
                          {t.serial_number ?? "—"}
                        </TableCell>
                        <TableCell>{t.brand ?? "—"}</TableCell>
                        <TableCell>{t.size ?? "—"}</TableCell>
                        <TableCell>{t.wheel_position ?? "—"}</TableCell>
                        <TableCell>
                          <StatusBadge value={t.condition} />
                        </TableCell>
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

          {data.tireMovements.length > 0 ? (
            <Card className="mt-4 overflow-hidden">
              <div className="border-b px-4 py-3">
                <h2 className="font-semibold">Tire movement history</h2>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Movement</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Technician</TableHead>
                      <TableHead>Verifier</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.tireMovements.map((tm: any) => (
                      <TableRow key={String(tm.id)}>
                        <TableCell className="whitespace-nowrap">
                          {String(tm.moved_at ?? "—").slice(0, 16)}
                        </TableCell>
                        <TableCell>{tm.movement_type ?? "—"}</TableCell>
                        <TableCell>{tm.wheel_position ?? "—"}</TableCell>
                        <TableCell>{tm.technician ?? "—"}</TableCell>
                        <TableCell>{tm.verifier ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          ) : null}
        </TabsContent>
      </Tabs>

      {maintenanceEditor.dialog}
    </>
  );
}
