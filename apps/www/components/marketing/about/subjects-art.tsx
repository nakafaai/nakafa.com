"use client";

import { useIntersection } from "@mantine/hooks";
import { GrainGradient } from "@paper-design/shaders-react";
import {
  getThemeAppearance,
  getThemeShaderColor,
} from "@repo/design-system/lib/theme/registry";
import { useReducedMotion } from "motion/react";
import { useTheme } from "next-themes";

/** Adds an alpha channel to a theme registry RGB color. */
function withAlpha(color: string, alpha: number) {
  return color.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
}

/** Renders one softly blended grain field behind the subject chooser. */
export function SubjectsArt() {
  const { ref, entry } = useIntersection({
    root: null,
    rootMargin: "240px",
    threshold: 0.01,
  });
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
      className="pointer-events-none absolute inset-0 opacity-90 [mask-image:radial-gradient(ellipse_108%_94%_at_56%_52%,black_0%,black_48%,rgba(0,0,0,0.84)_68%,rgba(0,0,0,0.42)_82%,transparent_100%)] dark:opacity-80"
      ref={ref}
    >
      {entry?.isIntersecting ? (
        <GrainGradient
          className="size-full"
          colorBack="rgba(0, 0, 0, 0)"
          colors={[
            withAlpha(themeColor, appearance === "dark" ? 0.82 : 0.74),
            withAlpha(nakafaAccent, appearance === "dark" ? 0.7 : 0.64),
            withAlpha(themeColor, appearance === "dark" ? 0.56 : 0.46),
            withAlpha(nakafaAccent, 0.32),
          ]}
          fit="cover"
          intensity={0.34}
          maxPixelCount={1_600_000}
          minPixelRatio={1.25}
          noise={0.22}
          offsetX={0.06}
          offsetY={0.04}
          rotation={-14}
          scale={0.78}
          shape="wave"
          softness={0.76}
          speed={shouldReduceMotion ? 0 : 0.18}
        />
      ) : null}
    </div>
  );
}
