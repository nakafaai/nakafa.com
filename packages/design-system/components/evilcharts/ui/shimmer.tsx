"use client";

import { useReducedMotion } from "@mantine/hooks";
import { m } from "motion/react";

const LOADING_ANIMATION_DURATION = 2000;

// Builds bell-curve eased gradient stops for the loading shimmer
const generateEasedGradientStops = (
  steps = 17,
  minOpacity = 0.05,
  maxOpacity = 0.9
) => {
  return Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1); // 0 to 1
    // Sine-based bell curve easing: peaks at center (t=0.5), smooth falloff at edges
    const eased = Math.sin(t * Math.PI) ** 2;
    const opacity = minOpacity + eased * (maxOpacity - minOpacity);
    return {
      offset: `${(t * 100).toFixed(0)}%`,
      opacity: Number(opacity.toFixed(3)),
    };
  });
};

export const LoadingShimmer = ({ chartId }: { chartId: string }) => {
  const shouldReduceMotion = useReducedMotion();
  const gradientStops = generateEasedGradientStops();

  if (shouldReduceMotion) {
    return (
      <mask id={`${chartId}-loading-mask`} maskUnits="userSpaceOnUse">
        <rect fill="white" height="100%" width="100%" />
      </mask>
    );
  }

  // 1 (left buffer) + 1 (visible) + 1 (right buffer)
  const patternWidth = 3;
  const startX = -1;
  const endX = 2;

  return (
    <>
      <linearGradient
        id={`${chartId}-loading-gradient`}
        x1="0"
        x2="1"
        y1="0"
        y2="0"
      >
        {gradientStops.map(({ offset, opacity }) => (
          <stop
            key={offset}
            offset={offset}
            stopColor="white"
            stopOpacity={opacity}
          />
        ))}
      </linearGradient>
      <pattern
        height="1"
        id={`${chartId}-loading-pattern`}
        patternContentUnits="objectBoundingBox"
        patternTransform="rotate(25)"
        patternUnits="objectBoundingBox"
        width={patternWidth}
        x="0"
        y="0"
      >
        <m.rect
          animate={{ x: endX }}
          fill={`url(#${chartId}-loading-gradient)`}
          height="1"
          initial={{ x: startX }}
          transition={{
            duration: LOADING_ANIMATION_DURATION / 1000,
            ease: "linear",
            repeat: Number.POSITIVE_INFINITY,
            repeatType: "loop",
          }}
          width="1"
          y="0"
        />
      </pattern>
      <mask id={`${chartId}-loading-mask`} maskUnits="userSpaceOnUse">
        <rect
          fill={`url(#${chartId}-loading-pattern)`}
          height="100%"
          width="100%"
        />
      </mask>
    </>
  );
};
