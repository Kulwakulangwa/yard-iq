export const DEFAULT_FX = 2600;
export const VAT_PERCENT = 18;

export function tzs(amount: number | null | undefined) {
  const n = Number(amount ?? 0);
  return `TZS ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n)}`;
}

export function usd(amount: number | null | undefined) {
  const n = Number(amount ?? 0);
  return `USD ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n)}`;
}

/** TZS headline with the USD equivalent underneath. */
export function dual(amountTzs: number | null | undefined, fx: number = DEFAULT_FX) {
  const n = Number(amountTzs ?? 0);
  const rate = fx > 0 ? fx : DEFAULT_FX;
  return { primary: tzs(n), secondary: usd(n / rate) };
}

export function toTzs(amountUsd: number, fx: number) {
  return Number(amountUsd ?? 0) * (fx > 0 ? fx : DEFAULT_FX);
}

export function advanceAmount(contractAmount: number, type: string, value: number) {
  if (type === "percentage") return (Number(contractAmount ?? 0) * Number(value ?? 0)) / 100;
  return Number(value ?? 0);
}

export function vatBreakdown(subtotal: number, percent: number = VAT_PERCENT) {
  const sub = Number(subtotal ?? 0);
  const vat = (sub * Number(percent ?? VAT_PERCENT)) / 100;
  return { subtotal: sub, vat, total: sub + vat };
}

export function fuelEstimateLitres(plannedKm: number | null | undefined) {
  return Number(plannedKm ?? 0) * 0.5;
}

export function sum<T>(rows: T[], pick: (r: T) => unknown) {
  return rows.reduce((s, r) => s + Number(pick(r) ?? 0), 0);
}
