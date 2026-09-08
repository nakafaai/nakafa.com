import { COLORS } from "@repo/design-system/lib/color";

/** Shared side identities connect the triangle geometry and authored names. */
export const TRIANGLE_SIDES = [
  { color: COLORS.CYAN, key: "adjacent", symbol: "b" },
  { color: COLORS.ORANGE, key: "opposite", symbol: "a" },
  { color: COLORS.ROSE, key: "hypotenuse", symbol: "c" },
] as const;
