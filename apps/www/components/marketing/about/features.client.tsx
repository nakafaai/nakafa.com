"use client";

import { Dithering, type DitheringProps } from "@paper-design/shaders-react";
import { getThemeShaderColor } from "@repo/design-system/lib/theme";
import { useTheme } from "next-themes";

export function FeaturesDithering({ ...props }: DitheringProps) {
  const { resolvedTheme } = useTheme();

  const colorFront = getThemeShaderColor(resolvedTheme);

  return (
    <Dithering
      className="size-full"
      colorBack="rgba(0, 0, 0, 0)"
      colorFront={colorFront}
      scale={1.2}
      shape="warp"
      size={2}
      speed={0.15}
      type="4x4"
      {...props}
    />
  );
}
