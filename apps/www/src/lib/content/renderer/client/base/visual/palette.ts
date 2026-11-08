import { PLOT_COLORS } from "@repo/design-system/lib/plot";

import type { MathAppearance } from "@/lib/content/renderer/client/base/visual/scene";

const PALETTE = {
  answer: PLOT_COLORS.fuchsia,
  construction: PLOT_COLORS.teal,
  highlight: PLOT_COLORS.amber,
  primary: PLOT_COLORS.orange,
  reference: PLOT_COLORS.slate,
  secondary: PLOT_COLORS.violet,
  warning: PLOT_COLORS.pink,
} satisfies Record<MathAppearance, string>;

/** Resolves each appearance to its own plot color, never an axis color. */
export function resolveMathAppearance(appearance: MathAppearance) {
  return PALETTE[appearance];
}
