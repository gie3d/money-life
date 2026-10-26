/** Always two decimals, whatever the currency (the exceptions are the shortened chart axes, which ask for `notation: "compact"`). */
export const money = (n: number, currency: string, opts: Intl.NumberFormatOptions = {}) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2, ...opts }).format(n);

/** A shortened amount for a chart axis, such as THB 9.5K. */
export const compactMoney = (n: number, currency: string) =>
  money(n, currency, { notation: "compact", minimumFractionDigits: 0, maximumFractionDigits: 2 });

export const signedMoney = (n: number, currency: string) =>
  (n > 0 ? "+" : n < 0 ? "−" : "") + money(Math.abs(n), currency);

export const pct = (n: number | null, digits = 1) =>
  n === null ? "—" : `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n * 100).toFixed(digits)}%`;

export const day = (iso: string, withYear = true) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: withYear ? "numeric" : undefined,
    timeZone: "UTC",
  });

/** Text class for a gain or loss. Colour is reserved for direction, never decoration. */
export const tone = (n: number) => (n > 0 ? "text-go-text" : n < 0 ? "text-miss-text" : "text-ink-3");

/** Price of one unit: two decimals like any amount, but a price under 1 keeps up to six so it doesn't round away. */
export const unitPrice = (n: number, currency: string) =>
  money(n, currency, n > 0 && n < 1 ? { maximumFractionDigits: 6 } : {});

export const units = (n: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 }).format(n);

/** A number as plain text for an input: no exponent form, no float noise. */
export const plainNumber = (n: number) => (String(n).includes("e") ? n.toFixed(8).replace(/\.?0+$/, "") : String(n));

/** "2026-12" as "Dec 2026". */
export const monthLabel = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
