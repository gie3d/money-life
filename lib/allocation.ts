/** How far each category sits from its target share of the total value. */
export type Drift = {
  id: string;
  /** Share of the total value now, 0 to 1. */
  share: number;
  target: number | null;
  /** Share less target, in shares (0.05 is 5 points over); null without a target. */
  diff: number | null;
  /** The money to move in (positive) or out (negative) to land on the target, the total staying the same. */
  toTarget: number | null;
};

/** Within this many points of its target, a category counts as on target. */
export const ON_TARGET = 0.02;

export function drift(rows: { id: string; value: number; target: number | null }[]): { rows: Drift[]; total: number; targetSum: number; furthest: Drift | null } {
  const total = rows.reduce((s, r) => s + r.value, 0);
  const out = rows.map((r) => {
    const share = total > 0 ? r.value / total : 0;
    if (r.target === null) return { id: r.id, share, target: null, diff: null, toTarget: null };
    return { id: r.id, share, target: r.target, diff: share - r.target, toTarget: r.target * total - r.value };
  });
  const targeted = out.filter((d) => d.diff !== null);
  const furthest = targeted.reduce<Drift | null>((m, d) => (m === null || Math.abs(d.diff!) > Math.abs(m.diff!) + 1e-9 ? d : m), null);
  return { rows: out, total, targetSum: targeted.reduce((s, d) => s + d.target!, 0), furthest };
}
