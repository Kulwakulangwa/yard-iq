import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { db } from "@/lib/db";

type Row = Record<string, unknown>;

/**
 * In-memory lookup maps built once from trips, trip_vehicles, loads, tires.
 * Used by the ref-rule engine to fade options that are irrelevant to
 * whatever pivot the user picked (usually a Trip).
 */
export type RelatedIndex = {
  /** customer_id → set of trip_ids for that customer */
  tripsByCustomer: Map<string, Set<string>>;
  /** vehicle_id → set of trip_ids the vehicle was on (as truck or trailer) */
  tripsByVehicle: Map<string, Set<string>>;
  /** driver_id → set of trip_ids the driver was on (main or convoy) */
  tripsByDriver: Map<string, Set<string>>;
  /** trip_id → set of all vehicle_ids on the trip (trucks + trailers) */
  vehiclesByTrip: Map<string, Set<string>>;
  /** trip_id → set of truck_ids only */
  trucksByTrip: Map<string, Set<string>>;
  /** trip_id → set of trailer_ids only */
  trailersByTrip: Map<string, Set<string>>;
  /** trip_id → set of driver_ids */
  driversByTrip: Map<string, Set<string>>;
  /** vehicle_id → set of driver_ids that ever drove that vehicle on a trip */
  driversByVehicle: Map<string, Set<string>>;
  /** trip_id → set of load_ids */
  loadsByTrip: Map<string, Set<string>>;
  /** vehicle_id → set of tire_ids currently installed */
  tiresByVehicle: Map<string, Set<string>>;
  isLoading: boolean;
};

const EMPTY_INDEX: RelatedIndex = {
  tripsByCustomer: new Map(),
  tripsByVehicle: new Map(),
  tripsByDriver: new Map(),
  vehiclesByTrip: new Map(),
  trucksByTrip: new Map(),
  trailersByTrip: new Map(),
  driversByTrip: new Map(),
  driversByVehicle: new Map(),
  loadsByTrip: new Map(),
  tiresByVehicle: new Map(),
  isLoading: false,
};

function push<K, V>(map: Map<K, Set<V>>, key: K, value: V) {
  const set = map.get(key);
  if (set) {
    set.add(value);
  } else {
    map.set(key, new Set([value]));
  }
}

export function useRelatedIndex(): RelatedIndex {
  const { data, isLoading } = useQuery({
    queryKey: ["related-index"],
    queryFn: async () => {
      const [trips, tripVehicles, loads, tires, vehicles] = await Promise.all([
        db.from("trips").select("id, customer_id, vehicle_id, driver_id"),
        db.from("trip_vehicles").select("trip_id, vehicle_id, trailer_id, driver_id"),
        db.from("loads").select("id, trip_id"),
        db.from("tires").select("id, vehicle_id"),
        db.from("vehicles").select("id, is_trailer"),
      ]);
      return {
        trips: (trips.data ?? []) as Row[],
        tripVehicles: (tripVehicles.data ?? []) as Row[],
        loads: (loads.data ?? []) as Row[],
        tires: (tires.data ?? []) as Row[],
        vehicles: (vehicles.data ?? []) as Row[],
      };
    },
  });

  return useMemo(() => {
    if (!data) return { ...EMPTY_INDEX, isLoading };

    const tripsByCustomer = new Map<string, Set<string>>();
    const tripsByVehicle = new Map<string, Set<string>>();
    const tripsByDriver = new Map<string, Set<string>>();
    const vehiclesByTrip = new Map<string, Set<string>>();
    const trucksByTrip = new Map<string, Set<string>>();
    const trailersByTrip = new Map<string, Set<string>>();
    const driversByTrip = new Map<string, Set<string>>();
    const driversByVehicle = new Map<string, Set<string>>();
    const loadsByTrip = new Map<string, Set<string>>();
    const tiresByVehicle = new Map<string, Set<string>>();

    const trailerIdSet = new Set(
      (data.vehicles ?? [])
        .filter((v) => Boolean(v.is_trailer))
        .map((v) => String(v.id)),
    );

    // Trips → customers, vehicles, drivers
    for (const t of data.trips) {
      const tripId = String(t.id);
      if (t.customer_id) push(tripsByCustomer, String(t.customer_id), tripId);
      if (t.vehicle_id) {
        const v = String(t.vehicle_id);
        push(tripsByVehicle, v, tripId);
        push(vehiclesByTrip, tripId, v);
        if (trailerIdSet.has(v)) push(trailersByTrip, tripId, v);
        else push(trucksByTrip, tripId, v);
        // Two-hop: vehicle → its driver on this trip
        if (t.driver_id) push(driversByVehicle, v, String(t.driver_id));
      }
      if (t.driver_id) {
        const d = String(t.driver_id);
        push(tripsByDriver, d, tripId);
        push(driversByTrip, tripId, d);
      }
    }

    // Convoy legs
    for (const tv of data.tripVehicles) {
      const tripId = String(tv.trip_id);
      if (tv.vehicle_id) {
        const v = String(tv.vehicle_id);
        push(tripsByVehicle, v, tripId);
        push(vehiclesByTrip, tripId, v);
        if (trailerIdSet.has(v)) push(trailersByTrip, tripId, v);
        else push(trucksByTrip, tripId, v);
        if (tv.driver_id) push(driversByVehicle, v, String(tv.driver_id));
      }
      if (tv.trailer_id) {
        const v = String(tv.trailer_id);
        push(tripsByVehicle, v, tripId);
        push(vehiclesByTrip, tripId, v);
        push(trailersByTrip, tripId, v);
      }
      if (tv.driver_id) {
        const d = String(tv.driver_id);
        push(tripsByDriver, d, tripId);
        push(driversByTrip, tripId, d);
      }
    }

    // Loads → trips
    for (const l of data.loads) {
      if (l.trip_id) push(loadsByTrip, String(l.trip_id), String(l.id));
    }

    // Tires → vehicles
    for (const t of data.tires) {
      if (t.vehicle_id) push(tiresByVehicle, String(t.vehicle_id), String(t.id));
    }

    return {
      tripsByCustomer,
      tripsByVehicle,
      tripsByDriver,
      vehiclesByTrip,
      trucksByTrip,
      trailersByTrip,
      driversByTrip,
      driversByVehicle,
      loadsByTrip,
      tiresByVehicle,
      isLoading: false,
    };
  }, [data, isLoading]);
}
