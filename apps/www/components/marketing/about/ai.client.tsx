"use client";

import { NeuroNoise } from "@paper-design/shaders-react";
import { getThemeShaderColor } from "@repo/design-system/lib/theme/registry";
import { useTheme } from "next-themes";

export function AiNeuroNoise() {
  const { resolvedTheme } = useTheme();
  const themeColor = getThemeShaderColor(resolvedTheme);

  return (
    <NeuroNoise
      brightness={0.15}
      className="size-full"
      colorBack="rgba(0, 0, 0, 0)"
      colorFront={themeColor}
      colorMid={themeColor}
      contrast={0.2}
      scale={1.5}
      speed={0.3}
    />
  );
}
