import { useQuery } from "@tanstack/react-query";
import { MapPin, Truck } from "lucide-react";

import { db } from "@/lib/db";
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

/** Convoy vehicles per trip, each with its own latest reported location. */
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
      const latestByTrip = new Map<string, Row>();
      for (const loc of (locations ?? []) as Row[]) {
        const legId = loc["trip_vehicle_id"] ? String(loc["trip_vehicle_id"]) : "";
        const tripId = String(loc["trip_id"]);
        if (legId && !latestByLeg.has(legId)) latestByLeg.set(legId, loc);
        if (!latestByTrip.has(tripId)) latestByTrip.set(tripId, loc);
      }

      const byTrip = new Map<string, ConvoyLeg[]>();
      for (const leg of (legs ?? []) as Row[]) {
        const id = String(leg["id"]);
        const tripId = String(leg["trip_id"]);
        const loc = latestByLeg.get(id) ?? latestByTrip.get(tripId) ?? {};
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
        };
        byTrip.set(tripId, [...(byTrip.get(tripId) ?? []), entry]);
      }
      return byTrip;
    },
  });
}

/** One table line per vehicle in a convoy, rendered under its trip row. */
export function ConvoyLegRows({ legs, colSpan }: { legs: ConvoyLeg[]; colSpan: number }) {
  return (
    <>
      {legs.map((leg, i) => (
        <TableRow key={leg.id} className="bg-muted/30 hover:bg-muted/40">
          <TableCell colSpan={colSpan} className="py-2">
            <div className="grid min-w-[660px] grid-cols-[minmax(150px,1.2fr)_minmax(120px,1fr)_minmax(140px,1fr)_minmax(220px,1.5fr)] items-center gap-4 pl-4">
              <div className="flex min-w-0 items-center gap-2">
                <Truck className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm font-medium">{leg.vehicle}</span>
                <span className="shrink-0 rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
                  {leg.role || (i === 0 ? "lead" : "follower")}
                </span>
              </div>
              <div className="min-w-0 text-sm text-muted-foreground">
                Trailer <span className="text-foreground">{leg.trailer}</span>
              </div>
              <div className="min-w-0 text-sm text-muted-foreground">
                Driver <span className="text-foreground">{leg.driver}</span>
              </div>
              <div className="flex min-w-0 items-center gap-1.5 text-sm">
                <MapPin className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">
                  {leg.location || "No location reported"}
                  {leg.checkpoint ? ` · ${leg.checkpoint}` : ""}
                </span>
                {leg.reportedAt ? (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    ({ago(leg.reportedAt)}
                    {leg.reportedBy ? ` · ${leg.reportedBy}` : ""})
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
 * Full vertical card-list of every vehicle on a trip.
 * Used on the trip summary page (not the list page).
 */
export function ConvoyLegList({ legs }: { legs: ConvoyLeg[] }) {
  if (legs.length === 0) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        No vehicles assigned yet. Use <strong>Edit trip</strong> to add them.
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
              {leg.role || (i === 0 ? "Lead" : "Follower")}
            </span>
            <span className="ml-auto text-xs text-muted-foreground">Leg {i + 1}</span>
          </div>

          <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div className="min-w-0">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Driver</dt>
              <dd className="mt-0.5 truncate font-medium">{leg.driver || "—"}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Trailer</dt>
              <dd className="mt-0.5 truncate font-medium">{leg.trailer || "—"}</dd>
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
              <div className="min-w-0">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Reported</dt>
                <dd className="mt-0.5 text-muted-foreground">
                  {ago(leg.reportedAt)}
                  {leg.reportedBy ? ` · ${leg.reportedBy}` : ""}
                </dd>
              </div>
            ) : null}
            {leg.notes ? (
              <div className="min-w-0 sm:col-span-2 lg:col-span-3">
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
