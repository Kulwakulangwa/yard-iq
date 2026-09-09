import { supabase } from "@/integrations/supabase/client";

export type Tone = "blue" | "amber" | "red" | "green" | "gray";

const RED = [
  "hold",
  "critical",
  "fail",
  "failed",
  "missing",
  "overdue",
  "rejected",
  "disputed",
  "suspended",
  "escalated",
  "theft",
  "cancelled",
  "high",
];
const AMBER = [
  "draft",
  "open",
  "pending",
  "awaiting",
  "submitted",
  "in progress",
  "under investigation",
  "loading",
  "partially",
  "inspection",
  "repair",
  "medium",
  "on hold",
  "sent",
];
const GREEN = ["paid", "delivered", "closed", "resolved", "reconciled", "completed", "released", "pass", "good"];
const BLUE = [
  "cleared",
  "approved",
  "verified",
  "active",
  "available",
  "dispatched",
  "in yard",
  "on trip",
  "installed",
  "ready",
  "in store",
  "low",
];

export function toneFor(value?: string | null): Tone {
  const v = (value ?? "").toLowerCase();
  if (!v) return "gray";
  if (RED.some((k) => v.includes(k))) return "red";
  if (AMBER.some((k) => v.includes(k))) return "amber";
  if (GREEN.some((k) => v.includes(k))) return "green";
  if (BLUE.some((k) => v.includes(k))) return "blue";
  return "gray";
}

export const toneClass: Record<Tone, string> = {
  blue: "bg-primary/10 text-primary border-primary/25",
  amber: "bg-warning/15 text-warning-foreground border-warning/40",
  red: "bg-destructive/10 text-destructive border-destructive/30",
  green: "bg-success/12 text-success border-success/30",
  gray: "bg-muted text-muted-foreground border-border",
};

export function humanize(key: string) {
  return key
    .replace(/_id$/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return new Intl.NumberFormat("en-US").format(value);
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    return new Date(s).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }
  return s;
}

export async function logAudit(action: string, entity: string, entityId?: string, details?: unknown) {
  try {
    await supabase.from("audit_logs").insert({
      action,
      entity,
      entity_id: entityId ?? null,
      details: (details ?? null) as never,
    });
  } catch {
    /* audit failures must never block the operation */
  }
}

export function exportCsv(filename: string, rows: Record<string, unknown>[], columns?: string[]) {
  if (!rows.length) return;
  const cols = columns ?? Object.keys(rows[0]!);
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [cols.map(humanize).join(","), ...rows.map((r) => cols.map((c) => escape(r[c])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function nextReference(prefix: string, existing: string[]) {
  const nums = existing
    .map((r) => Number(String(r).replace(/\D/g, "")))
    .filter((n) => !Number.isNaN(n) && n > 0);
  const next = (nums.length ? Math.max(...nums) : 1000) + 1;
  return `${prefix}-${next}`;
}
