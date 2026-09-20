import { Link2, Unlink } from "lucide-react";

import { Card } from "@/components/ui/card";
import { StatusBadge } from "./StatusBadge";

const YARD_STATUSES = ["Available", "In Yard", "Loading", "In Maintenance", "On Hold"];

function isInYard(v: any) {
  return YARD_STATUSES.includes(String(v.status));
}

/**
 * Three-panel view: coupled pairs, trucks without trailers, trailers without trucks.
 * Only considers vehicles physically in the yard (status != "On Trip").
 * Returns null when the yard is empty.
 */
export function PairingOverview({ vehicles }: { vehicles: any[] }) {
  const inYard = vehicles.filter(isInYard);
  const byId = new Map(inYard.map((v) => [String(v.id), v]));

  const coupledPairs = inYard
    .filter((v) => !v.is_trailer && v.coupled_to_id)
    .map((truck) => {
      const trailer = byId.get(String(truck.coupled_to_id));
      return trailer ? { truck, trailer } : null;
    })
    .filter(Boolean) as { truck: any; trailer: any }[];

  const soloTrucks = inYard.filter((v) => !v.is_trailer && !v.coupled_to_id);
  const freeTrailers = inYard.filter((v) => v.is_trailer && !v.coupled_to_id);

  if (inYard.length === 0) return null;

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {/* Coupled pairs */}
      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Link2 className="size-4 text-primary" />
            <h2 className="font-semibold">Coupled pairs</h2>
          </div>
          <span className="text-xs text-muted-foreground">{coupledPairs.length}</span>
        </div>
        {coupledPairs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No paired vehicles in yard.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {coupledPairs.map(({ truck, trailer }) => (
              <li key={truck.id} className="flex flex-wrap items-center gap-1.5">
                <span className="font-medium">{truck.registration_number}</span>
                <Link2 className="size-3 text-primary" />
                <span className="font-medium">{trailer.registration_number}</span>
                {truck.yard_zone ? (
                  <span className="ml-auto text-xs text-muted-foreground">{truck.yard_zone}</span>
                ) : (
                  <span className="ml-auto text-xs text-muted-foreground">no zone</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Solo trucks */}
      <Card className="border-warning/40 bg-warning/5 p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Unlink className="size-4 text-warning-foreground" />
            <h2 className="font-semibold">Trucks without trailer</h2>
          </div>
          <span className="text-xs text-muted-foreground">{soloTrucks.length}</span>
        </div>
        {soloTrucks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Every truck has a trailer.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {soloTrucks.map((truck) => (
              <li key={truck.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{truck.registration_number}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">
                    {truck.yard_zone || "no zone"}
                  </span>
                  <StatusBadge value={truck.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Free trailers */}
      <Card className="border-warning/40 bg-warning/5 p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Unlink className="size-4 text-warning-foreground" />
            <h2 className="font-semibold">Trailers without truck</h2>
          </div>
          <span className="text-xs text-muted-foreground">{freeTrailers.length}</span>
        </div>
        {freeTrailers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Every trailer has a truck.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {freeTrailers.map((trailer) => (
              <li key={trailer.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{trailer.registration_number}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">
                    {trailer.yard_zone || "no zone"}
                  </span>
                  <StatusBadge value={trailer.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
