import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Plus } from "lucide-react";

import { db } from "@/lib/db";
import { modules } from "@/lib/modules";
import { useRecordEditor } from "./RecordEditor";
import { Button } from "@/components/ui/button";

/**
 * Renders a button that opens the driver deduction editor with pre-filled
 * values. Used on incident/tire/fuel pages to turn a financial event into
 * a tracked deduction with one click.
 *
 * If `dedupe` is provided, the component checks whether a deduction already
 * exists with that key/value pair. When one does, the button is replaced
 * with an "already created" note so the same event can't be double-recovered.
 */
export function SuggestedDeduction({
  prefill,
  dedupe,
  label = "Create deduction",
  variant = "outline",
}: {
  prefill: Record<string, unknown>;
  dedupe?: { key: string; value: string };
  label?: string;
  variant?: "outline" | "default" | "ghost";
}) {
  const editor = useRecordEditor(modules.driver_deductions, []);

  const { data: existing } = useQuery({
    queryKey: ["deduction-exists", dedupe?.key ?? "none", dedupe?.value ?? ""],
    enabled: Boolean(dedupe),
    queryFn: async () => {
      if (!dedupe) return null;
      const { data, error } = await db
        .from("driver_deductions")
        .select("id, status")
        .eq(dedupe.key, dedupe.value)
        .limit(1);
      if (error) throw error;
      return ((data ?? [])[0] as { id: string; status: string } | undefined) ?? null;
    },
  });

  const safePrefill = useMemo(() => {
    const base: Record<string, unknown> = {
      deduction_date: new Date().toISOString().slice(0, 10),
      category: "Other",
      status: "Pending",
      ...prefill,
    };
    for (const k of Object.keys(base)) {
      const v = base[k];
      if (v === "" || v === undefined || v === null) delete base[k];
    }
    return base;
  }, [prefill]);

  if (dedupe && existing) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-success">
        <CheckCircle2 className="size-3.5" />
        Deduction already created
        {existing.status && existing.status !== "Pending" ? ` · ${existing.status}` : ""}
      </span>
    );
  }

  return (
    <>
      <Button variant={variant} onClick={() => editor.openNew(safePrefill)}>
        <Plus className="size-4" /> {label}
      </Button>
      {editor.dialog}
    </>
  );
}
