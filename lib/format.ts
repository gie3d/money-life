export const money = (n: number, currency: string, opts: Intl.NumberFormatOptions = {}) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0, ...opts }).format(n);

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

/** Price of one unit: keeps the decimals that money() rounds away. */
export const unitPrice = (n: number, currency: string) =>
  money(n, currency, { minimumFractionDigits: 2, maximumFractionDigits: 6 });

export const units = (n: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 }).format(n);
