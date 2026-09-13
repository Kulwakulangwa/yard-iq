import { Card } from "@/components/ui/card";

export function Stat({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "default" | "amber" | "red" | "green";
}) {
  const toneClass =
    tone === "red"
      ? "text-destructive"
      : tone === "amber"
        ? "text-warning-foreground"
        : tone === "green"
          ? "text-success"
          : "text-foreground";
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p> : null}
    </Card>
  );
}
