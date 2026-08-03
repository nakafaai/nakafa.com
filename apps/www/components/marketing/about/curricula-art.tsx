"use client";

import { useIntersection } from "@mantine/hooks";
import { ColorPanels } from "@paper-design/shaders-react";
import {
  getThemeAppearance,
  getThemeShaderColor,
} from "@repo/design-system/lib/theme/registry";
import { useReducedMotion } from "motion/react";
import { useTheme } from "next-themes";

/** Adds an alpha channel to an RGB shader color. */
function withAlpha(color: string, alpha: number) {
  return color.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
}

/** Returns country-informed shader colors for one curriculum program. */
function getCurriculumColors({
  appearance,
  programKey,
  themeColor,
}: {
  appearance: "dark" | "light";
  programKey: string;
  themeColor: string;
}) {
  const paperColor =
    appearance === "dark"
      ? "rgba(255, 255, 255, 0.58)"
      : "rgba(255, 255, 255, 0.82)";

  switch (programKey) {
    case "merdeka":
      return [
        withAlpha(themeColor, 0.72),
        "rgba(206, 17, 38, 0.88)",
        paperColor,
      ];
    case "cambridge-international":
      return [
        withAlpha(themeColor, 0.7),
        "rgba(1, 33, 105, 0.86)",
        "rgba(200, 16, 46, 0.76)",
        paperColor,
      ];
    case "singapore-moe":
      return [
        withAlpha(themeColor, 0.72),
        "rgba(239, 51, 64, 0.86)",
        paperColor,
      ];
    case "united-states":
      return [
        withAlpha(themeColor, 0.7),
        "rgba(60, 59, 110, 0.84)",
        "rgba(178, 34, 52, 0.76)",
        paperColor,
      ];
    default:
      return [withAlpha(themeColor, 0.76), paperColor];
  }
}

/** Renders one theme-aware curriculum color field that pauses outside view. */
export function CurriculaArt({
  maxPixelCount,
  programKey,
}: {
  maxPixelCount: number;
  programKey: string;
}) {
  const { resolvedTheme } = useTheme();
  const shouldReduceMotion = useReducedMotion() ?? false;
  const { ref, entry } = useIntersection({
    root: null,
    rootMargin: "240px",
    threshold: 0.05,
  });
  const appearance = getThemeAppearance(resolvedTheme);
  const themeColor = getThemeShaderColor(resolvedTheme);
  const colors = getCurriculumColors({
    appearance,
    programKey,
    themeColor,
  });
  const isMoving = entry?.isIntersecting && !shouldReduceMotion;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 opacity-90 [mask-image:linear-gradient(to_bottom,transparent_0%,rgba(0,0,0,0.08)_18%,rgba(0,0,0,0.72)_48%,black_76%,rgba(0,0,0,0.72)_90%,transparent_100%)] dark:opacity-80"
      ref={ref}
    >
      <ColorPanels
        angle1={0.34}
        angle2={0.28}
        blur={0.36}
        className="size-full"
        colorBack="rgba(0, 0, 0, 0)"
        colors={colors}
        density={1.45}
        edges={false}
        fadeIn={0.9}
        fadeOut={0.48}
        fit="cover"
        gradient={0.84}
        length={2.4}
        maxPixelCount={maxPixelCount}
        minPixelRatio={1.2}
        offsetY={0.2}
        rotation={270}
        scale={1.38}
        speed={isMoving ? 0.14 : 0}
      />
    </div>
  );
}
