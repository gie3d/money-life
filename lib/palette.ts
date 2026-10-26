/* Categorical colours for pie slices. Mid-tone so they hold on both the white and the black page. */
const PALETTE = ["#fd6217", "#0a84ff", "#30b455", "#af52de", "#e0a800", "#ff375f", "#32aadf", "#8e8e93"];

/** A slice's colour follows its position in `order`, so a category keeps its colour from chart to chart. */
export const colorFor = (id: string, order: readonly { id: string }[]) =>
  PALETTE[Math.max(0, order.findIndex((o) => o.id === id)) % PALETTE.length];
