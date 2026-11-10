import type { ReactNode } from "react";
import { money, tone } from "@/lib/format";

/** Where zero falls (0 = top, 1 = bottom) along a line that spans these values, so a colour can flip exactly at zero. */
export function zeroOffset(values: (number | null | undefined)[]) {
  const nums = values.filter((v): v is number => typeof v === "number");
  if (nums.length === 0) return 1;
  const hi = Math.max(...nums);
  const lo = Math.min(...nums);
  return hi <= 0 ? 0 : lo >= 0 ? 1 : hi / (hi - lo);
}

/** A vertical gradient that is green above zero and red below it. Use as `stroke="url(#id)"`. */
export function SignGradient({ id, values }: { id: string; values: (number | null | undefined)[] }) {
  const at = zeroOffset(values);
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset={at} stopColor="var(--go)" />
      <stop offset={at} stopColor="var(--miss)" />
    </linearGradient>
  );
}

/** An amount for a tooltip, green when `basis` (default: the amount) is positive and red when negative. */
export const toned = (v: number, currency: string, basis = v): ReactNode => <span className={tone(basis)}>{money(v, currency)}</span>;

/** Legend swatch for a line that is green above zero and red below. */
export const signSwatch = "bg-gradient-to-r from-go to-miss";

/**
 * The stroke for a line over these values: the gradient, or a plain colour when the line is flat (a gradient across
 * a zero-height line paints nothing).
 */
export function signStroke(id: string, values: (number | null | undefined)[]) {
  const nums = values.filter((v): v is number => typeof v === "number");
  if (nums.length > 0 && Math.min(...nums) === Math.max(...nums)) return nums[0] > 0 ? "var(--go)" : nums[0] < 0 ? "var(--miss)" : "var(--ink-3)";
  return `url(#${id})`;
}

/** The colour for a gain or loss, in the same terms as the gradients. */
const colour = (n: number) => (n > 0 ? "var(--go)" : n < 0 ? "var(--miss)" : "var(--ink-3)");

/**
 * A left-to-right gradient for a stepped line, green over each step where `diffs[i]` is positive and red where it is
 * negative. Points sit evenly along the line, so step i covers i/(n-1) to (i+1)/(n-1).
 */
export function RunGradient({ id, diffs }: { id: string; diffs: number[] }) {
  const n = diffs.length;
  const runs: { from: number; to: number; c: string }[] = [];
  diffs.slice(0, -1).forEach((d, i) => {
    const c = colour(d);
    const last = runs[runs.length - 1];
    if (last && last.c === c) last.to = (i + 1) / (n - 1);
    else runs.push({ from: i / (n - 1), to: (i + 1) / (n - 1), c });
  });
  return (
    <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
      {runs.flatMap((r, i) => [
        <stop key={`${i}a`} offset={r.from} stopColor={r.c} />,
        <stop key={`${i}b`} offset={r.to} stopColor={r.c} />,
      ])}
    </linearGradient>
  );
}

/** Stroke for a stepped line coloured by `RunGradient`; plain when the line is flat, since a gradient can't paint it. */
export function runStroke(id: string, values: number[], diffs: number[]) {
  if (Math.min(...values) === Math.max(...values)) return colour(diffs[diffs.length - 1] ?? 0);
  return `url(#${id})`;
}
