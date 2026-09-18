import { db } from "@/lib/db";

/**
 * Map a trip status to what every truck on the trip should become.
 * Called whenever a trip's status changes from the office side
 * (trips list "Move to X" menu, trip edit dialog save).
 *
 * Gate In / Gate Out already set individual vehicle statuses — this
 * helper is only for trip-level moves so trip and trucks never drift.
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
 * Push a trip's status down to every truck assigned to that trip.
 * Safe to call with an unknown status — it just does nothing.
 */
export async function syncTrucksForTrip(tripId: string, tripStatus: string) {
  const rule = TRIP_TO_VEHICLE[tripStatus];
  if (!rule) return;

  const { data: legs, error: legsErr } = await db
    .from("trip_vehicles")
    .select("vehicle_id")
    .eq("trip_id", tripId);
  if (legsErr) throw legsErr;

  const vehicleIds = ((legs ?? []) as { vehicle_id: string | null }[])
    .map((l) => l.vehicle_id)
    .filter((v): v is string => Boolean(v));

  if (vehicleIds.length === 0) return;

  const patch: Record<string, unknown> = { status: rule.vehicleStatus };
  if (rule.clearYardZone) patch["yard_zone"] = null;

  const { error } = await db
    .from("vehicles")
    .update(patch)
    .in("id", vehicleIds);
  if (error) throw error;
}

/**
 * Release a single truck back to Available when it is removed from a trip.
 * Called by TripConvoy when a leg is deleted.
 */
export async function releaseVehicle(vehicleId: string | null | undefined) {
  if (!vehicleId) return;
  const { error } = await db
    .from("vehicles")
    .update({ status: "Available", yard_zone: null })
    .eq("id", vehicleId);
  if (error) throw error;
}

/**
 * Apply the trip's current status to a single truck.
 * Called by TripConvoy when a new leg is added, so a truck added to an
 * already-Dispatched trip inherits "On Trip" instead of sitting at "Available".
 */
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
