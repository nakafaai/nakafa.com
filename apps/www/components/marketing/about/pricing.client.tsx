"use client";

import { Dithering, type DitheringProps } from "@paper-design/shaders-react";
import { useTheme } from "next-themes";
import { getColorFront } from "@/components/marketing/about/utils";

export function PricingDithering({ ...props }: DitheringProps) {
  const { theme } = useTheme();

  const colorFront = getColorFront(theme);

  return (
    <Dithering
      className="size-full"
      colorBack="#00000000"
      colorFront={colorFront}
      rotation={180}
      scale={1.2}
      shape="wave"
      size={11}
      speed={0.15}
      type="4x4"
      {...props}
    />
  );
}

export function EnterpriseDithering({ ...props }: DitheringProps) {
  const { theme } = useTheme();

  const colorFront = getColorFront(theme);

  return (
    <Dithering
      className="size-full"
      colorBack="#00000000"
      colorFront={colorFront}
      scale={1}
      shape="dots"
      size={8}
      speed={0.1}
      type="4x4"
      {...props}
    />
  );
}
