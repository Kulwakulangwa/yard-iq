export const DEFAULT_FX = 2600;
export const VAT_PERCENT = 18;

export type Currency = "USD" | "TZS";

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

/**
 * Convert an amount + currency pair into BOTH currencies using the given
 * FX rate (TZS per USD). Returns numeric values.
 *
 *   dualFrom(500, "USD", 2600)       → { tzs: 1_300_000, usd: 500 }
 *   dualFrom(1_300_000, "TZS", 2600) → { tzs: 1_300_000, usd: 500 }
 */
export function dualFrom(
  amount: number | null | undefined,
  currency: Currency | string | null | undefined,
  fx: number = DEFAULT_FX,
) {
  const rate = fx > 0 ? fx : DEFAULT_FX;
  const n = Number(amount ?? 0);
  if (String(currency ?? "").toUpperCase() === "USD") {
    return { tzs: n * rate, usd: n };
  }
  return { tzs: n, usd: n / rate };
}

/**
 * Formatted dual-currency display. Always TZS primary, USD secondary.
 *
 *   dualDisplay(500, "USD", 2600)
 *     → { primary: "TZS 1,300,000", secondary: "USD 500",
 *         tzsValue: 1300000, usdValue: 500 }
 */
export function dualDisplay(
  amount: number | null | undefined,
  currency: Currency | string | null | undefined,
  fx: number = DEFAULT_FX,
) {
  const { tzs: tzsValue, usd: usdValue } = dualFrom(amount, currency, fx);
  return {
    primary: tzs(tzsValue),
    secondary: usd(usdValue),
    tzsValue,
    usdValue,
  };
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
