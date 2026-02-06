"use client";

import { NeuroNoise } from "@paper-design/shaders-react";
import { useTheme } from "next-themes";
import { getColorFront } from "./features.client";

export function AiNeuroNoise() {
  const { theme } = useTheme();
  const themeColor = getColorFront(theme);

  return (
    <NeuroNoise
      brightness={0.15}
      className="size-full"
      colorBack="#00000000"
      colorFront={themeColor}
      colorMid={themeColor}
      contrast={0.4}
      scale={1.5}
      speed={0.3}
    />
  );
}
