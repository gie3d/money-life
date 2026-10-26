export type User = { id: number; email: string; name: string; currency: string };

export type Account = {
  id: number;
  name: string;
  categoryId: number;
  categoryName: string;
  categoryColor: string;
  /** From its category: cash and saving track a balance, investment tracks trades. */
  type: string;
  liquidity: string;
  archived: boolean;
};

export type Entry = {
  id: number;
  accountId: number;
  /** ISO date, yyyy-mm-dd. */
  date: string;
  value: number;
  /** Net money paid in since the previous entry; negative for a withdrawal. */
  contribution: number;
  note: string | null;
};

export type Trade = {
  id: number;
  accountId: number;
  date: string;
  side: "buy" | "sell";
  quantity: number;
  /** Price of one unit. */
  price: number;
  /** Trading fee for the whole trade, in the user's currency. */
  fee: number;
  note: string | null;
};

export type PricePoint = { id: number; accountId: number; date: string; price: number };

/** Investments are tracked by trades; cash and saving by balance alone. */
export const isInvestment = (a: { type: string }) => a.type === "investment";

export type Category = { id: number; name: string; type: string; color: string };

/** Swatches offered for a category; any hex colour is also accepted. Mid-tone, so they hold on white and on black. */
export const CATEGORY_COLORS = ["#fd6217", "#0a84ff", "#30b455", "#af52de", "#e0a800", "#ff375f", "#32aadf", "#8e8e93", "#00a693", "#7c5cff"] as const;

export const HEX = /^#[0-9a-fA-F]{6}$/;

/** The first swatch no category uses yet, or else the swatches again in turn. */
export const nextColor = (used: string[]) =>
  CATEGORY_COLORS.find((c) => !used.some((u) => u.toLowerCase() === c)) ?? CATEGORY_COLORS[used.length % CATEGORY_COLORS.length];

/** Created for every new user; they can rename or remove them. */
export const STARTER_CATEGORIES = [
  { name: "Cash & deposits", type: "cash" },
  { name: "Savings", type: "saving" },
  { name: "Stocks", type: "investment" },
  { name: "Funds", type: "investment" },
  { name: "Bonds", type: "investment" },
  { name: "Gold", type: "investment" },
  { name: "Crypto", type: "investment" },
  { name: "Real estate", type: "investment" },
] as const;

export const TYPES = [
  { id: "cash", label: "Cash" },
  { id: "saving", label: "Saving" },
  { id: "investment", label: "Investment" },
] as const;

/** How fast an asset can be turned into cash, fastest first. */
export const LIQUIDITY = [
  { id: "immediate", label: "Immediately" },
  { id: "days", label: "Days" },
  { id: "months", label: "Months" },
  { id: "years", label: "Years" },
  { id: "retirement", label: "Retirement" },
] as const;

export const labelOf = (list: readonly { id: string; label: string }[], id: string) =>
  list.find((x) => x.id === id)?.label ?? id;

export const CURRENCIES = ["THB", "USD", "EUR", "GBP", "JPY", "SGD", "AUD", "CAD"] as const;
