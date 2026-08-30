"use client";

import { useIntersection } from "@mantine/hooks";
import { Dithering, type DitheringProps } from "@paper-design/shaders-react";
import { getThemeShaderColor } from "@repo/design-system/lib/theme/registry";
import { useReducedMotion } from "motion/react";
import { useTheme } from "next-themes";

/** Keeps the landing-page shader outside the dedicated pricing route bundle. */
export function PricingDithering({ ...props }: DitheringProps) {
  const { ref, entry } = useIntersection({
    root: null,
    rootMargin: "240px",
    threshold: 0.01,
  });
  const { resolvedTheme } = useTheme();
  const shouldReduceMotion = useReducedMotion() ?? false;

  const colorFront = getThemeShaderColor(resolvedTheme);

  return (
    <div className="size-full" ref={ref}>
      {entry?.isIntersecting ? (
        <Dithering
          className="size-full"
          colorBack="rgba(0, 0, 0, 0)"
          colorFront={colorFront}
          rotation={180}
          scale={1.2}
          shape="wave"
          size={11}
          type="4x4"
          {...props}
          speed={shouldReduceMotion ? 0 : (props.speed ?? 0.15)}
        />
      ) : null}
    </div>
  );
}
