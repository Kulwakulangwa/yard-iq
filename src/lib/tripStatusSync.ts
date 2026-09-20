import { db } from "@/lib/db";

/**
 * Map a trip status to what every truck on the trip should become.
 * Called whenever a trip's status changes from the office side
 * (trips list "Move to X" menu, trip edit dialog save).
 *
 * Coupled trailers follow their truck automatically.
 * Drivers follow too, unless they're Suspended or Off Duty.
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

/** Which trip statuses put drivers in the "On Trip" state. */
const ACTIVE_TRIP_STATUSES = ["Dispatched", "In Transit", "At Border"];

/**
 * Push a trip's status down to every truck assigned to that trip,
 * each truck's coupled trailer, and every driver on the trip.
 */
export async function syncTrucksForTrip(tripId: string, tripStatus: string) {
  const rule = TRIP_TO_VEHICLE[tripStatus];
  if (!rule) return;

  // 1. Trucks on this trip (with their drivers too)
  const { data: legs, error: legsErr } = await db
    .from("trip_vehicles")
    .select("vehicle_id, driver_id")
    .eq("trip_id", tripId);
  if (legsErr) throw legsErr;

  const truckIds = ((legs ?? []) as { vehicle_id: string | null }[])
    .map((l) => l.vehicle_id)
    .filter((v): v is string => Boolean(v));

  const convoyDriverIds = ((legs ?? []) as { driver_id: string | null }[])
    .map((l) => l.driver_id)
    .filter((v): v is string => Boolean(v));

  // 2. Trip's own main driver
  const { data: trip, error: tripErr } = await db
    .from("trips")
    .select("driver_id")
    .eq("id", tripId)
    .maybeSingle();
  if (tripErr) throw tripErr;

  const mainDriverId = (trip as { driver_id: string | null } | null)?.driver_id ?? null;

  // 3. Coupled trailers of the trucks
  let trailerIds: string[] = [];
  if (truckIds.length > 0) {
    const { data: trucks, error: trucksErr } = await db
      .from("vehicles")
      .select("id, coupled_to_id")
      .in("id", truckIds);
    if (trucksErr) throw trucksErr;
    trailerIds = ((trucks ?? []) as { coupled_to_id: string | null }[])
      .map((t) => t.coupled_to_id)
      .filter((v): v is string => Boolean(v));
  }

  // 4. Update vehicles (trucks + coupled trailers)
  const allVehicleIds = [...truckIds, ...trailerIds];
  if (allVehicleIds.length > 0) {
    const vehiclePatch: Record<string, unknown> = { status: rule.vehicleStatus };
    if (rule.clearYardZone) vehiclePatch["yard_zone"] = null;
    const { error } = await db.from("vehicles").update(vehiclePatch).in("id", allVehicleIds);
    if (error) throw error;
  }

  // 5. Update drivers — but only if they're not manually flagged
  const allDriverIds = [...new Set([mainDriverId, ...convoyDriverIds].filter((v): v is string => Boolean(v)))];
  if (allDriverIds.length > 0) {
    const targetDriverStatus = ACTIVE_TRIP_STATUSES.includes(tripStatus) ? "On Trip" : "Available";
    // Only flip drivers who are currently Available or On Trip —
    // never overwrite a manual Suspended / Off Duty.
    const { error } = await db
      .from("drivers")
      .update({ status: targetDriverStatus })
      .in("id", allDriverIds)
      .in("status", ["Available", "On Trip"]);
    if (error) throw error;
  }
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
