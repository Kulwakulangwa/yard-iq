import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { db } from "@/lib/db";

/** Trip statuses that make their assigned drivers/trucks/trailers busy. */
export const ACTIVE_TRIP_STATUSES = ["Dispatched", "In Transit", "At Border"];

/** Vehicle statuses that block selection on a new trip. */
export const BUSY_VEHICLE_STATUSES = ["On Trip", "In Maintenance", "On Hold"];

export type Availability = {
  /** Driver ids currently committed to an active trip. */
  busyDriverIds: Set<string>;
  /** Truck ids currently committed (any active trip, maintenance or hold). */
  busyTruckIds: Set<string>;
  /** Trailer ids currently committed. */
  busyTrailerIds: Set<string>;
  /** Subset of busy ids that are specifically in maintenance (for badge text). */
  maintenanceIds: Set<string>;
  /** Map: truck id → coupled trailer id. */
  trailerByTruck: Map<string, string>;
  /** Map: driver id → assigned truck id (from drivers.assigned_vehicle_id). */
  truckByDriver: Map<string, string>;
  /** Map: vehicle id → the trip number it's currently committed to (for the faded label). */
  busyReasonByVehicleId: Map<string, string>;
  /** Map: driver id → the trip number they're currently committed to. */
  busyReasonByDriverId: Map<string, string>;
  isLoading: boolean;
};

const EMPTY: Availability = {
  busyDriverIds: new Set(),
  busyTruckIds: new Set(),
  busyTrailerIds: new Set(),
  maintenanceIds: new Set(),
  trailerByTruck: new Map(),
  truckByDriver: new Map(),
  busyReasonByVehicleId: new Map(),
  busyReasonByDriverId: new Map(),
  isLoading: false,
};

/**
 * Computes which drivers, trucks and trailers are currently unavailable.
 * Pass `excludeTripId` when editing an existing trip so that trip's own
 * assignments aren't flagged as a conflict with itself.
 */
export function useAvailability({ excludeTripId }: { excludeTripId?: string | null } = {}): Availability {
  const { data, isLoading } = useQuery({
    queryKey: ["availability", excludeTripId ?? "none"],
    queryFn: async () => {
      const [trips, tripVehicles, vehicles, drivers] = await Promise.all([
        db.from("trips").select("id, trip_number, driver_id, vehicle_id, trailer_id, status"),
        db.from("trip_vehicles").select("trip_id, driver_id, vehicle_id, trailer_id"),
        db.from("vehicles").select("id, status, is_trailer, coupled_to_id"),
        db.from("drivers").select("id, assigned_vehicle_id, assigned_trailer_id"),
      ]);
      return {
        trips: (trips.data ?? []) as any[],
        tripVehicles: (tripVehicles.data ?? []) as any[],
        vehicles: (vehicles.data ?? []) as any[],
        drivers: (drivers.data ?? []) as any[],
      };
    },
  });

  return useMemo(() => {
    if (!data) return { ...EMPTY, isLoading };

    const busyDriverIds = new Set<string>();
    const busyTruckIds = new Set<string>();
    const busyTrailerIds = new Set<string>();
    const maintenanceIds = new Set<string>();
    const trailerByTruck = new Map<string, string>();
    const truckByDriver = new Map<string, string>();
    const busyReasonByVehicleId = new Map<string, string>();
    const busyReasonByDriverId = new Map<string, string>();

    // 1. Active trips (excluding the one being edited)
    const activeTripNumberById = new Map<string, string>();
    for (const t of data.trips) {
      const id = String(t.id);
      if (excludeTripId && id === excludeTripId) continue;
      if (!ACTIVE_TRIP_STATUSES.includes(String(t.status))) continue;
      activeTripNumberById.set(id, String(t.trip_number ?? ""));

      if (t.driver_id) {
        busyDriverIds.add(String(t.driver_id));
        busyReasonByDriverId.set(String(t.driver_id), String(t.trip_number ?? ""));
      }
      if (t.vehicle_id) {
        busyTruckIds.add(String(t.vehicle_id));
        busyReasonByVehicleId.set(String(t.vehicle_id), String(t.trip_number ?? ""));
      }
      if (t.trailer_id) {
        busyTrailerIds.add(String(t.trailer_id));
        busyReasonByVehicleId.set(String(t.trailer_id), String(t.trip_number ?? ""));
      }
    }

    // 2. Convoy legs on active trips
    for (const tv of data.tripVehicles) {
      const tripId = String(tv.trip_id);
      if (excludeTripId && tripId === excludeTripId) continue;
      const tripNumber = activeTripNumberById.get(tripId);
      if (!tripNumber) continue;

      if (tv.driver_id) {
        busyDriverIds.add(String(tv.driver_id));
        busyReasonByDriverId.set(String(tv.driver_id), tripNumber);
      }
      if (tv.vehicle_id) {
        busyTruckIds.add(String(tv.vehicle_id));
        busyReasonByVehicleId.set(String(tv.vehicle_id), tripNumber);
      }
      if (tv.trailer_id) {
        busyTrailerIds.add(String(tv.trailer_id));
        busyReasonByVehicleId.set(String(tv.trailer_id), tripNumber);
      }
    }

    // 3. Vehicle statuses — On Trip, In Maintenance, On Hold block regardless of trip links
    for (const v of data.vehicles) {
      const id = String(v.id);
      const status = String(v.status ?? "");
      const isTrailer = Boolean(v.is_trailer);

      if (status === "On Trip" || status === "In Maintenance" || status === "On Hold") {
        if (isTrailer) busyTrailerIds.add(id);
        else busyTruckIds.add(id);
        if (!busyReasonByVehicleId.has(id)) busyReasonByVehicleId.set(id, status);
      }
      if (status === "In Maintenance") maintenanceIds.add(id);

      // Coupled trailer lookup (only meaningful for trucks)
      if (!isTrailer && v.coupled_to_id) {
        trailerByTruck.set(id, String(v.coupled_to_id));
      }
    }

    // 4. Driver → assigned truck lookup
    for (const d of data.drivers) {
      if (d.assigned_vehicle_id) {
        truckByDriver.set(String(d.id), String(d.assigned_vehicle_id));
      }
    }

    return {
      busyDriverIds,
      busyTruckIds,
      busyTrailerIds,
      maintenanceIds,
      trailerByTruck,
      truckByDriver,
      busyReasonByVehicleId,
      busyReasonByDriverId,
      isLoading,
    };
  }, [data, excludeTripId, isLoading]);
}
