"use client";

import { Dithering, type DitheringProps } from "@paper-design/shaders-react";
import { useTheme } from "next-themes";
import { getColorFront } from "@/components/marketing/about/utils";

export function FeaturesDithering({ ...props }: DitheringProps) {
  const { resolvedTheme } = useTheme();

  const colorFront = getColorFront(resolvedTheme);

  return (
    <Dithering
      className="size-full"
      colorBack="#00000000"
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
