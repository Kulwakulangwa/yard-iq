import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";

import { db } from "@/lib/db";
import { type RefTable } from "@/lib/modules";
import { StatusBadge } from "./StatusBadge";
import type { Row } from "./RecordEditor";

export function TripHeader({
  row,
  refs,
  actions,
}: {
  row: Row;
  refs: Partial<Record<RefTable, { id: string; label: string }[]>>;
  actions?: React.ReactNode;
}) {
  const vehicleId = row["vehicle_id"];
  const { data: vehicle } = useQuery({
    queryKey: ["vehicle-header", vehicleId],
    enabled: !!vehicleId,
    queryFn: async () => {
      const { data, error } = await db
        .from("vehicles")
        .select("registration_number, vehicle_type")
        .eq("id", String(vehicleId))
        .maybeSingle();
      if (error) throw error;
      return data as Row | null;
    },
  });

  const tripNumber = String(row["trip_number"] ?? "Trip");
  const origin = String(row["origin"] ?? "—");
  const destination = String(row["destination"] ?? "—");
  const status = String(row["status"] ?? "");

  const vehicleReg = String(
    vehicle?.["registration_number"] ??
      refs.vehicles?.find((v) => v.id === String(vehicleId))?.label ??
      "—",
  );
  const vehicleType = String(vehicle?.["vehicle_type"] ?? "");
  const driverName =
    refs.drivers?.find((d) => d.id === String(row["driver_id"]))?.label ?? "—";
  const km = Number(row["planned_distance"] ?? 0);

  const details = [
    vehicleReg,
    vehicleType || null,
    `Driver ${driverName}`,
    km ? `${km.toLocaleString()} km planned` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{tripNumber}</h1>
            {status ? <StatusBadge value={status} /> : null}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-4 shrink-0 text-primary" />
            <span className="truncate">
              {origin} → {destination}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{details}</p>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
