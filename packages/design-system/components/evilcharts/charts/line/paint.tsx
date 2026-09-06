"use client";

import {
  type ChartConfig,
  getChartColorVariable,
  getChartSeriesId,
  getColorsCount,
} from "@repo/design-system/components/evilcharts/ui/chart-config";
import type { OrderedRevealAnimation } from "@repo/design-system/components/evilcharts/ui/reveal-animation";

/**
 * Direction of the custom motion.dev intro reveal. Recharts' own line animation
 * is permanently disabled (it drew the line after the dots had already popped
 * in), these reveals replace it.
 *
 * NOTE: a reveal is a per-frame animated SVG mask, so it is heavier than a
 * static chart. `"none"` opts out entirely; it is also what a device with the
 * OS "reduce motion" preference falls back to automatically.
 */
export type LineAnimationType = "none" | OrderedRevealAnimation;

// Style definitions, one set per <Line />, scoped to its unique id

interface StyleProps {
  dataKey: string; // series key the style belongs to
  id: string; // unique id of the owning <Line />
}

// Animated dashed-stroke effect, rendered as a child of the Recharts Line
export const AnimatedDashedStroke = () => (
  <>
    <animate
      attributeName="stroke-dasharray"
      dur="1s"
      keyTimes="0;0.5;1"
      repeatCount="indefinite"
      values="5 5; 0 5; 5 5"
    />
    <animate
      attributeName="stroke-dashoffset"
      dur="1s"
      keyTimes="0;1"
      repeatCount="indefinite"
      values="0; -10"
    />
  </>
);

/**
 * Horizontal left-to-right color gradient for multi-stop line and dot paints.
 * Single-color line strokes use the scoped CSS variable directly so perfectly
 * horizontal or vertical paths do not depend on an object-bounding-box gradient.
 */
export const ColorGradient = ({
  id,
  dataKey,
  config,
}: StyleProps & { config: ChartConfig }) => {
  const colorsCount = getColorsCount(config[dataKey] ?? {});

  return (
    <linearGradient
      gradientUnits="userSpaceOnUse"
      id={getChartSeriesId(id, "colors", dataKey)}
      x1="0"
      x2="100%"
      y1="0"
      y2="0"
    >
      {colorsCount === 1 ? (
        <>
          <stop offset="0%" stopColor={getChartColorVariable(dataKey, 0)} />
          <stop offset="100%" stopColor={getChartColorVariable(dataKey, 0)} />
        </>
      ) : (
        Array.from({ length: colorsCount }, (_, index) => {
          const offset = `${(index / (colorsCount - 1)) * 100}%`;
          return (
            <stop
              key={offset}
              offset={offset}
              stopColor={getChartColorVariable(dataKey, index, 0)}
            />
          );
        })
      )}
    </linearGradient>
  );
};

/** Soft outer glow filter applied to a glowing line. */
export const GlowFilter = ({ id, dataKey }: StyleProps) => (
  <filter
    height="200%"
    id={getChartSeriesId(id, "glow", dataKey)}
    width="200%"
    x="-50%"
    y="-50%"
  >
    <feGaussianBlur in="SourceGraphic" result="blur" stdDeviation="10" />
    <feColorMatrix
      in="blur"
      result="glow"
      type="matrix"
      values="1 0 0 0 0
                0 1 0 0 0
                0 0 1 0 0
                0 0 0 2 0"
    />
    <feMerge>
      <feMergeNode in="glow" />
      <feMergeNode in="SourceGraphic" />
    </feMerge>
  </filter>
);
