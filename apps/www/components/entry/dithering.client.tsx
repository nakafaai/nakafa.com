"use client";

import { useReducedMotion } from "@mantine/hooks";
import { Dithering } from "@paper-design/shaders-react";
import { getThemeShaderColor } from "@repo/design-system/lib/theme/registry";
import { useTheme } from "next-themes";

/**
 * The pixel budget of this artwork's canvas. The shader lowers its render
 * resolution on large or high-density screens to stay within it, up to rounding.
 */
const DITHERING_PIXEL_BUDGET = 1_200_000;

export function EntryDithering() {
  const { resolvedTheme } = useTheme();
  const shouldReduceMotion = useReducedMotion(undefined, {
    getInitialValueInEffect: false,
  });

  const colorFront = getThemeShaderColor(resolvedTheme);

  return (
    <Dithering
      className="size-full"
      colorBack="rgba(0, 0, 0, 0)"
      colorFront={colorFront}
      maxPixelCount={DITHERING_PIXEL_BUDGET}
      scale={1.2}
      shape="warp"
      size={2}
      speed={shouldReduceMotion ? 0 : 0.15}
      type="4x4"
    />
  );
}
