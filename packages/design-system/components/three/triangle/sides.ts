import { PLOT_COLORS } from "@repo/design-system/lib/plot";

/** Shared side identities connect the triangle geometry and authored names. */
export const TRIANGLE_SIDES = [
  { color: PLOT_COLORS.teal, key: "adjacent", symbol: "b" },
  { color: PLOT_COLORS.orange, key: "opposite", symbol: "a" },
  { color: PLOT_COLORS.pink, key: "hypotenuse", symbol: "c" },
] as const;
