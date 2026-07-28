"use client";

import { MeshGradient } from "@paper-design/shaders-react";
import {
  getThemeAppearance,
  getThemeShaderColor,
} from "@repo/design-system/lib/theme/registry";
import { useReducedMotion } from "motion/react";
import { useTheme } from "next-themes";

function withAlpha(color: string, alpha: number) {
  return color.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
}

/** Adds one slowly moving, theme-aware paper field beside the hero copy. */
export function HeroArt() {
  const { resolvedTheme } = useTheme();
  const shouldReduceMotion = useReducedMotion() ?? false;
  const appearance = getThemeAppearance(resolvedTheme);
  const themeColor = getThemeShaderColor(resolvedTheme);
  const nakafaAccent = getThemeShaderColor(
    appearance === "dark" ? "light" : "dark"
  );

  return (
    <div
      aria-hidden="true"
      className="fade-in animation-duration-700 motion-reduce:animation-duration-200 pointer-events-none relative size-full animate-in fill-mode-both ease-[cubic-bezier(0.23,1,0.32,1)]"
    >
      <MeshGradient
        className="size-full opacity-90 [mask-composite:intersect] [mask-image:linear-gradient(to_bottom,transparent_0%,rgba(0,0,0,0.12)_6%,rgba(0,0,0,0.38)_14%,rgba(0,0,0,0.75)_26%,black_38%,black_66%,rgba(0,0,0,0.65)_78%,rgba(0,0,0,0.25)_90%,transparent_100%),linear-gradient(to_right,transparent_0%,black_46%,black_100%)] dark:opacity-75"
        colors={[
          withAlpha(themeColor, 0.24),
          themeColor,
          nakafaAccent,
          withAlpha(nakafaAccent, 0.78),
        ]}
        distortion={0.6}
        grainMixer={0.08}
        grainOverlay={0.07}
        maxPixelCount={1_200_000}
        minPixelRatio={1}
        offsetX={0.16}
        rotation={12}
        scale={1.12}
        speed={shouldReduceMotion ? 0 : 0.14}
        swirl={0.18}
      />
    </div>
  );
}
