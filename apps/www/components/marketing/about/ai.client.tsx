"use client";

import { NeuroNoise } from "@paper-design/shaders-react";
import { useTheme } from "next-themes";
import { getColorFront } from "@/components/marketing/about/utils";

export function AiNeuroNoise() {
  const { resolvedTheme } = useTheme();
  const themeColor = getColorFront(resolvedTheme);

  return (
    <NeuroNoise
      brightness={0.15}
      className="size-full"
      colorBack="#00000000"
      colorFront={themeColor}
      colorMid={themeColor}
      contrast={0.2}
      scale={1.5}
      speed={0.3}
    />
  );
}
