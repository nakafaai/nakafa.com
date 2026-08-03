"use client";

import { useIntersection } from "@mantine/hooks";
import { Warp } from "@paper-design/shaders-react";
import { getThemeShaderColor } from "@repo/design-system/lib/theme/registry";
import { useReducedMotion } from "motion/react";
import { useTheme } from "next-themes";

/** Adds an alpha channel to a theme registry RGB color. */
function withAlpha(color: string, alpha: number) {
  return color.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
}

/** Renders one shared curriculum field that pauses outside view. */
export function CurriculaArt({ maxPixelCount }: { maxPixelCount: number }) {
  const { resolvedTheme } = useTheme();
  const shouldReduceMotion = useReducedMotion() ?? false;
  const { ref, entry } = useIntersection({
    root: null,
    rootMargin: "240px",
    threshold: 0.05,
  });
  const themeColor = getThemeShaderColor(resolvedTheme);
  const isMoving = entry?.isIntersecting && !shouldReduceMotion;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 opacity-90 [mask-image:linear-gradient(to_bottom,black_0%,black_28%,rgba(0,0,0,0.78)_50%,rgba(0,0,0,0.28)_78%,transparent_100%)] dark:opacity-80"
      ref={ref}
    >
      <Warp
        className="size-full"
        colors={[
          withAlpha(themeColor, 0.18),
          "#ee0000",
          "#ffffff",
          "#012169",
          "#c8102e",
          "#ed2939",
          "#2e52b2",
          "#d80027",
        ]}
        distortion={0.38}
        fit="cover"
        maxPixelCount={maxPixelCount}
        minPixelRatio={1.2}
        offsetY={0.68}
        proportion={0.36}
        rotation={0}
        scale={1.42}
        shape="edge"
        shapeScale={0.86}
        softness={0.82}
        speed={isMoving ? 2.5 : 0}
        swirl={0.44}
        swirlIterations={6}
      />
    </div>
  );
}
