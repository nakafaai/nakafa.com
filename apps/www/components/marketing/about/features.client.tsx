"use client";

import { Dithering, type DitheringProps } from "@paper-design/shaders-react";
import { getThemeShaderColor } from "@repo/design-system/lib/theme/registry";
import { useReducedMotion } from "motion/react";
import { useTheme } from "next-themes";

/**
 * The hero field's pixel budget, which caps the canvas. The dither block still
 * spans two CSS pixels, so only the field's resolution changes.
 */
const DITHERING_PIXEL_BUDGET = 1_200_000;

export function FeaturesDithering({ ...props }: DitheringProps) {
  const { resolvedTheme } = useTheme();
  const shouldReduceMotion = useReducedMotion() ?? false;

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
      {...props}
    />
  );
}
