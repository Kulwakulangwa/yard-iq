/**
 * Declarative summary cards for the generic list pages. Each spec is computed
 * client-side over the rows already loaded by `DataModule`.
 */
export type StatSpec = {
  label: string;
  kind: "count" | "sum";
  /** Column to sum when kind === "sum". */
  key?: string;
  /** Only rows whose `filter.key` value is in / not in this list are counted. */
  filter?: { key: string; in?: string[]; notIn?: string[] };
  /** Limit to the current calendar month using this date column. */
  monthKey?: string;
  /** Format as TZS with the USD equivalent underneath. */
  money?: boolean;
  tone?: "default" | "amber" | "red" | "green";
  suffix?: string;
};

const OPEN_TRIPS = ["Dispatched", "In Transit", "At Border"];

export const MODULE_STATS: Record<string, StatSpec[]> = {
  trips: [
    { label: "In transit", kind: "count", filter: { key: "status", in: OPEN_TRIPS }, tone: "amber" },
    { label: "Completed", kind: "count", filter: { key: "status", in: ["Completed", "Closed"] }, tone: "green" },
    { label: "Planned distance", kind: "sum", key: "planned_distance", suffix: " km" },
    { label: "Total trips", kind: "count" },
  ],
  loads: [
    { label: "Loads planned", kind: "count" },
    { label: "Awaiting verification", kind: "count", filter: { key: "status", in: ["Loaded", "Loading", "Awaiting Loading"] }, tone: "amber" },
    { label: "Verified", kind: "count", filter: { key: "status", in: ["Verified", "Dispatched", "Delivered", "Reconciled"] }, tone: "green" },
    { label: "Expected weight", kind: "sum", key: "expected_weight" },
  ],
  fuel_allocations: [
    { label: "Litres approved", kind: "sum", key: "approved_litres", suffix: " L" },
    { label: "Fuel cost", kind: "sum", key: "fuel_cost", money: true },
    { label: "Pending approval", kind: "count", filter: { key: "status", in: ["Draft"] }, tone: "amber" },
    { label: "Allocations", kind: "count" },
  ],
  expenses: [
    { label: "Total logged", kind: "sum", key: "amount", money: true },
    { label: "Approved / paid", kind: "sum", key: "amount", filter: { key: "status", in: ["Approved", "Paid"] }, money: true, tone: "green" },
    { label: "Pending", kind: "sum", key: "amount", filter: { key: "status", in: ["Draft", "Submitted"] }, money: true, tone: "amber" },
    { label: "Fuel litres", kind: "sum", key: "volume_liters", suffix: " L" },
  ],
  operational_expenses: [
    { label: "Total spend", kind: "sum", key: "amount_tzs", money: true },
    { label: "This month", kind: "sum", key: "amount_tzs", monthKey: "expense_date", money: true },
    { label: "Entries", kind: "count" },
  ],
  vehicle_maintenance: [
    { label: "Jobs open", kind: "count", filter: { key: "status", notIn: ["Completed"] }, tone: "amber" },
    { label: "Total cost", kind: "sum", key: "cost_tzs", money: true },
    { label: "Paid", kind: "sum", key: "paid_amount", money: true, tone: "green" },
    { label: "Workshop hours", kind: "sum", key: "duration_hours", suffix: " h" },
  ],
  work_orders: [
    { label: "Open jobs", kind: "count", filter: { key: "status", notIn: ["Completed", "Released"] }, tone: "amber" },
    { label: "Released", kind: "count", filter: { key: "status", in: ["Released"] }, tone: "green" },
    { label: "Actual cost", kind: "sum", key: "actual_cost", money: true },
    { label: "Estimated cost", kind: "sum", key: "cost_estimate", money: true },
  ],
  technicians: [
    { label: "Technicians", kind: "count" },
    { label: "Active", kind: "count", filter: { key: "status", in: ["Active"] }, tone: "green" },
  ],
  tires: [
    { label: "Installed", kind: "count", filter: { key: "status", in: ["Installed"] }, tone: "green" },
    { label: "In store", kind: "count", filter: { key: "status", in: ["In Store"] } },
    { label: "Repair / retread", kind: "count", filter: { key: "status", in: ["Repair/Retread", "Inspection"] }, tone: "amber" },
    { label: "Missing / disputed", kind: "count", filter: { key: "status", in: ["Missing", "Disputed"] }, tone: "red" },
  ],
  tire_movements: [
    { label: "Movements", kind: "count" },
    { label: "This month", kind: "count", monthKey: "moved_at" },
    { label: "Installs", kind: "count", filter: { key: "movement_type", in: ["Install"] } },
    { label: "Removals", kind: "count", filter: { key: "movement_type", in: ["Remove"] }, tone: "amber" },
  ],
  invoices: [
    { label: "Invoiced", kind: "sum", key: "amount", money: true },
    { label: "Paid", kind: "sum", key: "paid_amount_tzs", money: true, tone: "green" },
    { label: "Awaiting payment", kind: "count", filter: { key: "status", in: ["Sent", "Partially Paid", "Overdue"] }, tone: "amber" },
    { label: "Invoices", kind: "count" },
  ],
  driver_payments: [
    { label: "Salaries", kind: "sum", key: "amount_tzs", filter: { key: "payment_type", in: ["Salary"] }, money: true },
    { label: "Advances", kind: "sum", key: "amount_tzs", filter: { key: "payment_type", in: ["Advance"] }, money: true, tone: "amber" },
    { label: "Bonuses", kind: "sum", key: "amount_tzs", filter: { key: "payment_type", in: ["Bonus"] }, money: true, tone: "green" },
    { label: "Payments", kind: "count" },
  ],
  customers: [
    { label: "Customers", kind: "count" },
    { label: "Active", kind: "count", filter: { key: "status", in: ["Active"] }, tone: "green" },
    { label: "On hold", kind: "count", filter: { key: "status", in: ["On Hold"] }, tone: "amber" },
  ],
  contracts: [
    { label: "Contracts", kind: "count" },
    { label: "Active", kind: "count", filter: { key: "status", in: ["Active"] }, tone: "green" },
    { label: "Contracted value", kind: "sum", key: "contract_amount" },
  ],
  vehicle_inspections: [
    { label: "Inspections", kind: "count" },
    { label: "Passed", kind: "count", filter: { key: "result", in: ["Pass"] }, tone: "green" },
    { label: "Failed", kind: "count", filter: { key: "result", in: ["Fail"] }, tone: "red" },
    { label: "With defects", kind: "count", filter: { key: "result", in: ["Pass with defects"] }, tone: "amber" },
  ],
  incidents: [
    { label: "Open", kind: "count", filter: { key: "status", in: ["Open", "Under Investigation", "Escalated"] }, tone: "amber" },
    { label: "Resolved", kind: "count", filter: { key: "status", in: ["Resolved", "Closed"] }, tone: "green" },
    { label: "Critical", kind: "count", filter: { key: "severity", in: ["Critical", "High"] }, tone: "red" },
    { label: "Financial impact", kind: "sum", key: "financial_impact", money: true },
  ],
  police_cases: [
    { label: "Cases", kind: "count" },
    { label: "Open", kind: "count", filter: { key: "case_status", in: ["Open", "Under Investigation"] }, tone: "amber" },
    { label: "Closed", kind: "count", filter: { key: "case_status", in: ["Closed"] }, tone: "green" },
  ],
  yard_zones: [
    { label: "Zones", kind: "count" },
    { label: "Active zones", kind: "count", filter: { key: "active", in: ["true"] }, tone: "green" },
    { label: "Total capacity", kind: "sum", key: "capacity" },
  ],
  vehicles: [
    { label: "Vehicles", kind: "count" },
    { label: "On trip", kind: "count", filter: { key: "status", in: ["On Trip", "Loading"] }, tone: "amber" },
    { label: "In maintenance", kind: "count", filter: { key: "status", in: ["In Maintenance", "On Hold"] }, tone: "red" },
    { label: "Available", kind: "count", filter: { key: "status", in: ["Available", "In Yard"] }, tone: "green" },
  ],
  drivers: [
    { label: "Drivers", kind: "count" },
    { label: "On trip", kind: "count", filter: { key: "status", in: ["On Trip"] }, tone: "amber" },
    { label: "Available", kind: "count", filter: { key: "status", in: ["Available"] }, tone: "green" },
    { label: "Monthly salary bill", kind: "sum", key: "monthly_salary_tzs", money: true },
  ],
};

function inMonth(value: unknown) {
  if (!value) return false;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export function computeStat(rows: Record<string, unknown>[], spec: StatSpec) {
  let list = rows;
  if (spec.filter) {
    const { key, in: inc, notIn } = spec.filter;
    list = list.filter((r) => {
      const v = String(r[key] ?? "");
      if (inc && !inc.includes(v)) return false;
      if (notIn && notIn.includes(v)) return false;
      return true;
    });
  }
  if (spec.monthKey) list = list.filter((r) => inMonth(r[spec.monthKey!]));
  if (spec.kind === "count") return list.length;
  return list.reduce((s, r) => s + Number(r[spec.key ?? ""] ?? 0), 0);
}
