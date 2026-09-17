import { Stat } from "./Stat";
import { computeStat, MODULE_STATS, type StatSpec } from "@/lib/moduleStats";
import { useFxRate } from "@/lib/fx";
import { dual } from "@/lib/money";

const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** Summary card strip above a list page, driven by MODULE_STATS. */
export function ModuleStats({ table, rows }: { table: string; rows: Record<string, unknown>[] }) {
  const fx = useFxRate();
  const specs: StatSpec[] = MODULE_STATS[table] ?? [];
  if (specs.length === 0) return null;

  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {specs.map((spec) => {
        const value = computeStat(rows, spec);
        const tone = spec.tone ?? "default";
        if (spec.money) {
          const d = dual(value, fx);
          return <Stat key={spec.label} label={spec.label} value={d.primary} sub={d.secondary} tone={tone} />;
        }
        return (
          <Stat
            key={spec.label}
            label={spec.label}
            value={`${fmt.format(Number(value))}${spec.suffix ?? ""}`}
            tone={tone}
          />
        );
      })}

    </div>
  );
}
