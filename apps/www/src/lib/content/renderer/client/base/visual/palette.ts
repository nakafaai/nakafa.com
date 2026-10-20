import { getColor } from "@repo/design-system/lib/color";

import type { MathAppearance } from "@/lib/content/renderer/client/base/visual/scene";

const PALETTE = {
  answer: getColor("FUCHSIA"),
  construction: getColor("TEAL"),
  highlight: getColor("AMBER"),
  primary: getColor("ORANGE"),
  reference: getColor("SLATE"),
  secondary: getColor("VIOLET"),
  warning: getColor("PINK"),
} satisfies Record<MathAppearance, string>;

/** Resolves subject colors while reserving red, green, and blue for Cartesian axes. */
export function resolveMathAppearance(appearance: MathAppearance) {
  return PALETTE[appearance];
}
