import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

type Hit = { label: string; group: string; to: string };

const SOURCES: { table: string; column: string; group: string; to: string }[] = [
  { table: "trips", column: "trip_number", group: "Trips", to: "/m/trips" },
  { table: "loads", column: "load_reference", group: "Loads", to: "/m/loads" },
  { table: "vehicles", column: "registration_number", group: "Vehicles", to: "/m/vehicles" },
  { table: "drivers", column: "full_name", group: "Drivers", to: "/m/drivers" },
  { table: "tires", column: "serial_number", group: "Tires", to: "/m/tires" },
  { table: "incidents", column: "incident_number", group: "Incidents", to: "/m/incidents" },
];

export function GlobalSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open || term.trim().length < 2) {
      setHits([]);
      return;
    }
    let active = true;
    const t = setTimeout(async () => {
      const results = await Promise.all(
        SOURCES.map(async (s) => {
          const { data } = await (supabase as never as any)
            .from(s.table)
            .select(s.column)
            .ilike(s.column, `%${term}%`)
            .limit(5);
          return ((data ?? []) as Record<string, string>[]).map((r) => ({
            label: String(r[s.column]),
            group: s.group,
            to: s.to,
          }));
        }),
      );
      if (active) setHits(results.flat());
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [term, open]);

  const groups = [...new Set(hits.map((h) => h.group))];

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        value={term}
        onValueChange={setTerm}
        placeholder="Trip number, load reference, registration, driver, tire, incident…"
      />
      <CommandList>
        <CommandEmpty>{term.length < 2 ? "Type at least two characters." : "No matches."}</CommandEmpty>
        {groups.map((g) => (
          <CommandGroup key={g} heading={g}>
            {hits
              .filter((h) => h.group === g)
              .map((h) => (
                <CommandItem
                  key={g + h.label}
                  value={`${g}-${h.label}`}
                  onSelect={() => {
                    onOpenChange(false);
                    navigate({ to: h.to, search: { q: h.label } as never });
                  }}
                >
                  {h.label}
                </CommandItem>
              ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
