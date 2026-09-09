import { toneClass, toneFor, type Tone } from "@/lib/orbis";
import { cn } from "@/lib/utils";

export function StatusBadge({
  value,
  tone,
  className,
}: {
  value?: string | null;
  tone?: Tone;
  className?: string;
}) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        toneClass[tone ?? toneFor(value)],
        className,
      )}
    >
      {value}
    </span>
  );
}
