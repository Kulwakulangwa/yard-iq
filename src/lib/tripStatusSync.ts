import { db } from "@/lib/db";

/**
 * Map a trip status to what every truck on the trip should become.
 * Called whenever a trip's status changes from the office side
 * (trips list "Move to X" menu, trip edit dialog save).
 *
 * Coupled trailers follow their truck automatically — see syncTrucksForTrip.
 */
const TRIP_TO_VEHICLE: Record<
  string,
  { vehicleStatus: string; clearYardZone: boolean }
> = {
  Draft: { vehicleStatus: "Available", clearYardZone: false },
  Approved: { vehicleStatus: "Available", clearYardZone: false },
  "Ready for Yard": { vehicleStatus: "Available", clearYardZone: false },
  "In Yard": { vehicleStatus: "In Yard", clearYardZone: false },
  Dispatched: { vehicleStatus: "On Trip", clearYardZone: true },
  "In Transit": { vehicleStatus: "On Trip", clearYardZone: true },
  "At Border": { vehicleStatus: "On Trip", clearYardZone: true },
  Delivered: { vehicleStatus: "Available", clearYardZone: true },
  "Pending Settlement": { vehicleStatus: "Available", clearYardZone: true },
  Completed: { vehicleStatus: "Available", clearYardZone: true },
  Closed: { vehicleStatus: "Available", clearYardZone: true },
  Cancelled: { vehicleStatus: "Available", clearYardZone: false },
};

/**
 * Push a trip's status down to every truck assigned to that trip,
 * plus each truck's coupled trailer (they travel together).
 */
export async function syncTrucksForTrip(tripId: string, tripStatus: string) {
  const rule = TRIP_TO_VEHICLE[tripStatus];
  if (!rule) return;

  // 1. Trucks on this trip
  const { data: legs, error: legsErr } = await db
    .from("trip_vehicles")
    .select("vehicle_id")
    .eq("trip_id", tripId);
  if (legsErr) throw legsErr;

  const truckIds = ((legs ?? []) as { vehicle_id: string | null }[])
    .map((l) => l.vehicle_id)
    .filter((v): v is string => Boolean(v));

  if (truckIds.length === 0) return;

  // 2. Coupled trailers of those trucks
  const { data: trucks, error: trucksErr } = await db
    .from("vehicles")
    .select("id, coupled_to_id")
    .in("id", truckIds);
  if (trucksErr) throw trucksErr;

  const trailerIds = ((trucks ?? []) as { coupled_to_id: string | null }[])
    .map((t) => t.coupled_to_id)
    .filter((v): v is string => Boolean(v));

  // 3. Update trucks + their coupled trailers in one statement
  const allIds = [...truckIds, ...trailerIds];
  const patch: Record<string, unknown> = { status: rule.vehicleStatus };
  if (rule.clearYardZone) patch["yard_zone"] = null;

  const { error } = await db.from("vehicles").update(patch).in("id", allIds);
  if (error) throw error;
}

/** Release a single truck back to Available when it is removed from a trip. */
export async function releaseVehicle(vehicleId: string | null | undefined) {
  if (!vehicleId) return;
  const { error } = await db
    .from("vehicles")
    .update({ status: "Available", yard_zone: null })
    .eq("id", vehicleId);
  if (error) throw error;
}

/** Apply the trip's current status to a single truck added to an already-dispatched trip. */
export async function applyTripStatusToVehicle(
  vehicleId: string,
  tripStatus: string,
) {
  const rule = TRIP_TO_VEHICLE[tripStatus];
  if (!rule) return;
  const patch: Record<string, unknown> = { status: rule.vehicleStatus };
  if (rule.clearYardZone) patch["yard_zone"] = null;
  const { error } = await db.from("vehicles").update(patch).eq("id", vehicleId);
  if (error) throw error;
}
