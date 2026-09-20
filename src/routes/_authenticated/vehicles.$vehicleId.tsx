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

export const Route = createFileRoute("/_authenticated/vehicles/$vehicleId")({
  head: () => ({
    meta: [
      { title: "Vehicle Profile — Orbis Logistics" },
      { name: "description", content: "Full vehicle profile: trips, maintenance, fuel, inspections and tires." },
      { property: "og:title", content: "Vehicle Profile — Orbis Logistics" },
      { property: "og:description", content: "Full vehicle profile: trips, maintenance, fuel, inspections and tires." },
    ],
  }),
  component: VehicleProfile,
});

function VehicleProfile() {
  const { vehicleId } = useParams({ from: "/_authenticated/vehicles/$vehicleId" });

  const { data, isLoading } = useQuery({
    queryKey: ["vehicle-profile", vehicleId],
    queryFn: async () => {
      const [
        vehicles,
        trips,
        financials,
        maintenance,
        workOrders,
        fuelAllocations,
        expenses,
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
        selectAll("fuel_allocations"),
        selectAll("expenses"),
        selectAll("vehicle_inspections"),
        selectAll("tires"),
        selectAll("tire_movements"),
        selectAll("drivers"),
        selectAll("technicians"),
        selectAll("trip_vehicles"),
      ]);

      const vehicle = vehicles.find((v: any) => String(v.id) === vehicleId) ?? null;
      const finByTrip = new Map(financials.map((f: any) => [f.trip_id, f]));
      const driverName = new Map(drivers.map((d: any) => [String(d.id), d.full_name]));
      const techName = new Map(technicians.map((t: any) => [String(t.id), t.full_name]));
      const tripNum = new Map(trips.map((t: any) => [String(t.id), t.trip_number]));

      const convoyTripIds = new Set(
        tripVehicles
          .filter((tv: any) => String(tv.vehicle_id) === vehicleId)
          .map((tv: any) => String(tv.trip_id)),
      );

      const ownTrips = trips
        .filter(
          (t: any) =>
            String(t.vehicle_id) === vehicleId || convoyTripIds.has(String(t.id)),
        )
        .map((t: any) => ({
          ...t,
          driverName: driverName.get(String(t.driver_id)) ?? "—",
          revenue: Number(finByTrip.get(t.id)?.total_contract_tzs ?? 0),
          isConvoyOnly:
            String(t.vehicle_id) !== vehicleId && convoyTripIds.has(String(t.id)),
        }));

      // Coupled trailer (if any)
      const coupledTrailer = vehicle?.coupled_to_id
        ? vehicles.find((x: any) => String(x.id) === String(vehicle.coupled_to_id)) ?? null
        : null;

      return {
        vehicle,
        coupledTrailer,
        trips: ownTrips,
        maintenance: maintenance.filter((m: any) => String(m.vehicle_id) === vehicleId),
        workOrders: workOrders.filter((w: any) => String(w.vehicle_id) === vehicleId),
        fuelAllocations: fuelAllocations.filter((f: any) => String(f.vehicle_id) === vehicleId),
        fuelExpenses: expenses.filter(
          (e: any) => String(e.vehicle_id) === vehicleId && e.category === "Fuel",
        ),
        inspections: inspections.filter((i: any) => String(i.vehicle_id) === vehicleId),
        tires: tires.filter((t: any) => String(t.vehicle_id) === vehicleId),
        tireMovements: tireMovements.filter((tm: any) => String(tm.vehicle_id) === vehicleId),
        tripNum,
        techName,
      };
    },
  });

  const maintRows = data?.maintenance ?? [];
  const maintenanceEditor = useRecordEditor(modules.vehicle_maintenance, maintRows);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading vehicle…</p>;
  if (!data?.vehicle) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <h1 className="text-lg font-semibold">Vehicle not found</h1>
        <Link to="/vehicles" className="mt-2 inline-block text-sm text-primary hover:underline">
          Back to vehicles
        </Link>
      </div>
    );
  }

  const v: any = data.vehicle;
  const km = sum(data.trips, (t: any) => t.planned_distance);
  const revenue = sum(data.trips, (t: any) => t.revenue);
  const maintCost = sum(data.maintenance, (j: any) => j.cost_tzs);
  const fuelLitres =
    sum(data.fuelAllocations, (f: any) => f.approved_litres) +
    sum(data.fuelExpenses, (e: any) => e.volume_liters);
  const fuelSpend =
    sum(data.fuelAllocations, (f: any) => f.fuel_cost) +
    sum(data.fuelExpenses, (e: any) => e.amount);

  const maintTabCount = data.maintenance.length + data.workOrders.length;
  const fuelTabCount = data.fuelAllocations.length + data.fuelExpenses.length;

  function openNewMaintenance() {
    maintenanceEditor.openNew({
      vehicle_id: vehicleId,
      maintenance_date: new Date().toISOString().slice(0, 10),
    });
  }

  return (
    <>
      <Link
        to="/vehicles"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All vehicles
      </Link>

      <PageHeader
        title={String(v.registration_number ?? "Vehicle")}
        subtitle={`${v.vehicle_type ?? "Vehicle"} · ${v.capacity ?? "—"} capacity`}
        actions={
          <Button variant="outline" onClick={openNewMaintenance}>
            <Plus className="size-4" /> New maintenance
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <StatusBadge value={v.status} />
        {data.coupledTrailer ? (
          <span className="inline-flex items-center gap-1.5 text-sm">
            <Link2 className="size-4 text-primary" />
            <span className="text-muted-foreground">Coupled to trailer</span>
            <Link
              to="/trailers/$trailerId"
              params={{ trailerId: String(data.coupledTrailer.id) }}
              className="font-medium text-primary hover:underline"
            >
              {data.coupledTrailer.registration_number}
            </Link>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Link2 className="size-4" />
            No trailer coupled
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Trips" value={data.trips.length} sub="Assigned to this vehicle" />
        <Stat label="Total KM" value={km.toLocaleString()} sub="Planned distance" />
        <Stat label="Revenue booked" value={tzs(revenue)} sub="From contract value" tone="green" />
        <Stat
          label="Maintenance cost"
          value={tzs(maintCost)}
          sub={`${data.maintenance.length} record${data.maintenance.length === 1 ? "" : "s"}`}
          tone="amber"
        />
      </div>

      <Tabs defaultValue="details" className="mt-6">
        <div className="overflow-x-auto">
          <TabsList className="w-max">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="trips">
              Trips {data.trips.length > 0 ? <span className="ml-1.5 text-xs opacity-70">{data.trips.length}</span> : null}
            </TabsTrigger>
            <TabsTrigger value="maintenance">
              Maintenance {maintTabCount > 0 ? <span className="ml-1.5 text-xs opacity-70">{maintTabCount}</span> : null}
            </TabsTrigger>
            <TabsTrigger value="fuel">
              Fuel {fuelTabCount > 0 ? <span className="ml-1.5 text-xs opacity-70">{fuelTabCount}</span> : null}
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
              <h2 className="font-semibold">Vehicle details</h2>
              <p className="text-sm text-muted-foreground">Complete information for this truck.</p>
            </div>
            <dl className="grid sm:grid-cols-2 xl:grid-cols-3">
              {(
                [
                  ["registration_number", "Registration"],
                  ["vehicle_type", "Type"],
                  ["capacity", "Capacity"],
                  ["odometer", "Odometer"],
                  ["status", "Status"],
                  ["yard_zone", "Yard zone"],
                  ["assigned_driver", "Assigned driver"],
                  ["documents_expiry", "Documents expiry"],
                  ["is_trailer", "Is trailer"],
                ] as [string, string][]
              ).map(([key, label]) => (
                <div key={key} className="min-w-0 border-b p-4 sm:border-r">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
                  <dd className="mt-1 break-words text-sm font-medium">
                    {key === "status" ? (
                      <StatusBadge value={String(v[key] ?? "")} />
                    ) : key === "is_trailer" ? (
                      v[key] ? "Yes" : "No"
                    ) : (
                      formatValue(v[key])
                    )}
                  </dd>
                </div>
              ))}
              {data.coupledTrailer ? (
                <div className="min-w-0 border-b p-4 sm:border-r">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Coupled trailer</dt>
                  <dd className="mt-1 text-sm font-medium">
                    <Link
                      to="/trailers/$trailerId"
                      params={{ trailerId: String(data.coupledTrailer.id) }}
                      className="text-primary hover:underline"
                    >
                      {data.coupledTrailer.registration_number}
                    </Link>
                  </dd>
                </div>
              ) : null}
              {v.notes ? (
                <div className="min-w-0 border-b p-4 sm:col-span-2 xl:col-span-3">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Notes</dt>
                  <dd className="mt-1 whitespace-pre-wrap text-sm">{String(v.notes)}</dd>
                </div>
              ) : null}
            </dl>
          </Card>
        </TabsContent>

        <TabsContent value="trips" className="mt-4">
          <Card className="overflow-hidden">
            <div className="border-b px-4 py-3">
              <h2 className="font-semibold">Trip history</h2>
              <p className="text-sm text-muted-foreground">
                Trips where this vehicle is the lead truck or a convoy leg.
              </p>
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
                    <TableHead>Revenue</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.trips.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7}>No trips recorded.</TableCell>
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
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {t.origin ?? "—"} → {t.destination ?? "—"}
                        </TableCell>
                        <TableCell>{t.driverName}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {String(t.planned_departure ?? "—").slice(0, 16)}
                        </TableCell>
                        <TableCell>{Number(t.planned_distance ?? 0).toLocaleString()}</TableCell>
                        <TableCell className="whitespace-nowrap">{tzs(t.revenue)}</TableCell>
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

        <TabsContent value="fuel" className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Stat label="Total litres" value={fuelLitres.toLocaleString()} sub="Allocated + expenses" tone="amber" />
            <Stat label="Total fuel spend" value={tzs(fuelSpend)} sub="All sources" tone="red" />
          </div>

          <Card className="mt-4 overflow-hidden">
            <div className="border-b px-4 py-3">
              <h2 className="font-semibold">Fuel allocations</h2>
              <p className="text-sm text-muted-foreground">Office-side budget lines for this vehicle.</p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ref</TableHead>
                    <TableHead>Trip</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Planned L</TableHead>
                    <TableHead>Approved L</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.fuelAllocations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8}>No allocations recorded.</TableCell>
                    </TableRow>
                  ) : (
                    data.fuelAllocations.map((f: any) => (
                      <TableRow key={String(f.id)}>
                        <TableCell className="whitespace-nowrap font-medium">{f.reference ?? "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {data.tripNum.get(String(f.trip_id)) ?? "—"}
                        </TableCell>
                        <TableCell>{f.fuel_type ?? "—"}</TableCell>
                        <TableCell>{Number(f.planned_litres ?? 0).toLocaleString()}</TableCell>
                        <TableCell>{Number(f.approved_litres ?? 0).toLocaleString()}</TableCell>
                        <TableCell className="whitespace-nowrap">{tzs(f.fuel_cost)}</TableCell>
                        <TableCell>{f.supplier ?? "—"}</TableCell>
                        <TableCell>
                          <StatusBadge value={f.status} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>

          <Card className="mt-4 overflow-hidden">
            <div className="border-b px-4 py-3">
              <h2 className="font-semibold">Fuel expenses</h2>
              <p className="text-sm text-muted-foreground">
                Fuel entries logged in the Expense book against this vehicle.
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Expense #</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Volume</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.fuelExpenses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6}>No fuel expenses logged.</TableCell>
                    </TableRow>
                  ) : (
                    data.fuelExpenses.map((e: any) => (
                      <TableRow key={String(e.id)}>
                        <TableCell className="whitespace-nowrap">
                          {String(e.expense_date ?? "—").slice(0, 10)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-medium">
                          {e.expense_number ?? "—"}
                        </TableCell>
                        <TableCell>{e.supplier ?? "—"}</TableCell>
                        <TableCell>
                          {e.volume_liters ? `${Number(e.volume_liters).toLocaleString()} L` : "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-medium">
                          {tzs(e.amount)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge value={e.status} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
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
                    <TableHead>Odometer</TableHead>
                    <TableHead>Inspector</TableHead>
                    <TableHead>Findings</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.inspections.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6}>No inspections recorded.</TableCell>
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
                        <TableCell>{Number(i.odometer ?? 0).toLocaleString()}</TableCell>
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
                Tires whose current vehicle is this truck.
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
                      <TableHead>Odometer</TableHead>
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
                        <TableCell>{Number(tm.odometer ?? 0).toLocaleString()}</TableCell>
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
