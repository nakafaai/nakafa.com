import { getColor } from "@repo/design-system/lib/color";

import type { MathAppearance } from "@/lib/content/renderer/client/base/visual/scene";

const PALETTE = {
  answer: getColor("GREEN"),
  construction: getColor("TEAL"),
  highlight: getColor("AMBER"),
  primary: getColor("BLUE"),
  reference: getColor("SLATE"),
  secondary: getColor("VIOLET"),
  warning: getColor("RED"),
} satisfies Record<MathAppearance, string>;

/** Resolves one authored semantic role into Nakafa's stable visual palette. */
export function resolveMathAppearance(appearance: MathAppearance) {
  return PALETTE[appearance];
}
