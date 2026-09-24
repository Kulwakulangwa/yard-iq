import { useQuery } from "@tanstack/react-query";
import { Fuel, MapPin, Truck } from "lucide-react";

import { db } from "@/lib/db";
import { tzs } from "@/lib/money";
import { TableCell, TableRow } from "@/components/ui/table";

type Row = Record<string, unknown>;

export type ConvoyLeg = {
  id: string;
  tripId: string;
  role: string;
  notes: string;
  vehicle: string;
  trailer: string;
  driver: string;
  location: string;
  reportedAt: string;
  reportedBy: string;
  checkpoint: string;
  fuelLitres: number;
  fuelCost: number;
};

export function ago(iso: string) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

function pickNewer(a: Row | undefined, b: Row | undefined): Row | undefined {
  if (!a) return b;
  if (!b) return a;
  const ta = new Date(String(a["reported_at"] ?? "")).getTime();
  const tb = new Date(String(b["reported_at"] ?? "")).getTime();
  if (Number.isNaN(ta)) return b;
  if (Number.isNaN(tb)) return a;
  return ta >= tb ? a : b;
}

export function useConvoyLegs() {
  return useQuery({
    queryKey: ["convoy-legs"],
    queryFn: async () => {
      const [{ data: legs }, { data: vehicles }, { data: drivers }, { data: locations }] = await Promise.all([
        db.from("trip_vehicles").select("*").order("created_at", { ascending: true }),
        db.from("vehicles").select("id, registration_number").limit(1000),
        db.from("drivers").select("id, full_name").limit(1000),
        db.from("trip_locations").select("*").order("reported_at", { ascending: false }).limit(2000),
      ]);

      const vName = new Map(((vehicles ?? []) as Row[]).map((v) => [String(v["id"]), String(v["registration_number"] ?? "")]));
      const dName = new Map(((drivers ?? []) as Row[]).map((d) => [String(d["id"]), String(d["full_name"] ?? "")]));

      const latestByLeg = new Map<string, Row>();
      const latestTripOnly = new Map<string, Row>();
      for (const loc of (locations ?? []) as Row[]) {
        const legId = loc["trip_vehicle_id"] ? String(loc["trip_vehicle_id"]) : "";
        const tripId = String(loc["trip_id"]);
        if (legId) {
          if (!latestByLeg.has(legId)) latestByLeg.set(legId, loc);
        } else {
          if (!latestTripOnly.has(tripId)) latestTripOnly.set(tripId, loc);
        }
      }

      const legsByTrip = new Map<string, Row[]>();
      for (const leg of (legs ?? []) as Row[]) {
        const tripId = String(leg["trip_id"]);
        legsByTrip.set(tripId, [...(legsByTrip.get(tripId) ?? []), leg]);
      }

      const byTrip = new Map<string, ConvoyLeg[]>();
      for (const [tripId, tripLegs] of legsByTrip) {
        const tripWide = latestTripOnly.get(tripId);
        for (const leg of tripLegs) {
          const id = String(leg["id"]);
          const loc = pickNewer(latestByLeg.get(id), tripWide) ?? {};
          const entry: ConvoyLeg = {
            id,
            tripId,
            role: String(leg["role"] ?? ""),
            notes: String(leg["notes"] ?? ""),
            vehicle: vName.get(String(leg["vehicle_id"])) ?? "—",
            trailer: vName.get(String(leg["trailer_id"])) ?? "—",
            driver: dName.get(String(leg["driver_id"])) ?? "—",
            location: String(loc["location"] ?? ""),
            reportedAt: String(loc["reported_at"] ?? ""),
            reportedBy: String(loc["reported_by"] ?? ""),
            checkpoint: String(loc["checkpoint"] ?? ""),
            fuelLitres: Number(leg["fuel_budget_litres"] ?? 0),
            fuelCost: Number(leg["fuel_budget_cost"] ?? 0),
          };
          byTrip.set(tripId, [...(byTrip.get(tripId) ?? []), entry]);
        }
      }
      return byTrip;
    },
  });
}

/**
 * Nested rows shown under each trip. Reads as an indented sub-line, not a
 * mini-table. Column alignment is intentionally loose so it stays legible
 * at any viewport width.
 */
export function ConvoyLegRows({ legs, colSpan }: { legs: ConvoyLeg[]; colSpan: number }) {
  return (
    <>
      {legs.map((leg, i) => (
        <TableRow
          key={leg.id}
          className="border-0 bg-muted/20 hover:bg-muted/30"
        >
          <TableCell colSpan={colSpan} className="py-2 pl-0 pr-4">
            {/* Left accent bar to signal nesting */}
            <div className="flex items-start gap-3 pl-6">
              <div
                aria-hidden
                className="mt-1 h-full w-px self-stretch bg-border"
              />

              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                {/* Truck + role */}
                <span className="inline-flex items-center gap-1.5">
                  <Truck className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="font-medium text-foreground">{leg.vehicle}</span>
                  <span className="rounded-full border border-border/60 bg-background px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {leg.role || (i === 0 ? "Lead" : "Convoy")}
                  </span>
                </span>

                {/* Driver */}
                <span className="text-muted-foreground">
                  Driver <span className="font-medium text-foreground">{leg.driver}</span>
                </span>

                {/* Trailer — only if set */}
                {leg.trailer && leg.trailer !== "—" ? (
                  <span className="text-muted-foreground">
                    Trailer <span className="font-medium text-foreground">{leg.trailer}</span>
                  </span>
                ) : null}

                {/* Location + when */}
                <span className="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground">
                  <MapPin className="size-3 shrink-0" />
                  <span className="truncate">
                    {leg.location || "No location"}
                    {leg.checkpoint ? ` · ${leg.checkpoint}` : ""}
                  </span>
                  {leg.reportedAt ? (
                    <span className="shrink-0 opacity-70">
                      ({ago(leg.reportedAt)}
                      {leg.reportedBy ? ` · ${leg.reportedBy}` : ""})
                    </span>
                  ) : null}
                </span>

                {/* Fuel — only if set */}
                {leg.fuelLitres > 0 ? (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Fuel className="size-3 shrink-0" />
                    {leg.fuelLitres.toLocaleString()} L
                    {leg.fuelCost > 0 ? ` · ${tzs(leg.fuelCost)}` : ""}
                  </span>
                ) : null}
              </div>
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

/**
 * Card-list version, used on the trip detail page.
 */
export function ConvoyLegList({ legs }: { legs: ConvoyLeg[] }) {
  if (legs.length === 0) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        No trucks assigned yet. Use <strong>Edit trip</strong> to add them.
      </div>
    );
  }

  return (
    <ul className="divide-y">
      {legs.map((leg, i) => (
        <li key={leg.id} className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Truck className="size-4 text-primary" />
            <span className="text-base font-semibold">{leg.vehicle}</span>
            <span className="rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-xs font-medium text-primary">
              {leg.role || (i === 0 ? "Lead" : "Convoy")}
            </span>
            <span className="ml-auto text-xs text-muted-foreground">Truck {i + 1}</span>
          </div>

          <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Driver</dt>
              <dd className="mt-0.5 truncate font-medium">{leg.driver || "—"}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Trailer</dt>
              <dd className="mt-0.5 truncate font-medium">{leg.trailer || "—"}</dd>
            </div>
            <div className="min-w-0">
              <dt className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                <Fuel className="size-3" /> Fuel budget
              </dt>
              <dd className="mt-0.5">
                {leg.fuelLitres > 0 ? (
                  <div>
                    <div className="font-medium">{leg.fuelLitres.toLocaleString()} L</div>
                    {leg.fuelCost > 0 ? (
                      <div className="text-xs text-muted-foreground">{tzs(leg.fuelCost)}</div>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-muted-foreground">Not set</span>
                )}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Latest location</dt>
              <dd className="mt-0.5 flex min-w-0 items-center gap-1.5">
                <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">
                  {leg.location || "No location reported"}
                  {leg.checkpoint ? ` · ${leg.checkpoint}` : ""}
                </span>
              </dd>
            </div>
            {leg.reportedAt ? (
              <div className="min-w-0 sm:col-span-2">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Reported</dt>
                <dd className="mt-0.5 text-muted-foreground">
                  {ago(leg.reportedAt)}
                  {leg.reportedBy ? ` · ${leg.reportedBy}` : ""}
                </dd>
              </div>
            ) : null}
            {leg.notes ? (
              <div className="min-w-0 sm:col-span-2 lg:col-span-4">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Note</dt>
                <dd className="mt-0.5 text-muted-foreground">{leg.notes}</dd>
              </div>
            ) : null}
          </dl>
        </li>
      ))}
    </ul>
  );
}
