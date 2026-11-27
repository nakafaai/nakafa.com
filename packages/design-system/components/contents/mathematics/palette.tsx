import { CALCULUS_COLORS } from "@repo/design-system/lib/material/calculus";
import { getThemeAppearance } from "@repo/design-system/lib/theme/registry";
import { useTheme } from "@repo/design-system/providers/theme";

/**
 * The plotted colors of a coordinate lab in the reader's appearance, so every
 * curve, vector and label keeps its contrast on the light and the dark card.
 */
export function useCalculusColors() {
  const resolvedTheme = useTheme((state) => state.resolvedTheme);
  return CALCULUS_COLORS[getThemeAppearance(resolvedTheme)];
}
