"use client";

import type { StyleProps } from "@repo/design-system/components/evilcharts/charts/composed/bars";
import {
  type ChartConfig,
  getChartColorVariable,
  getChartSeriesId,
  getColorsCount,
} from "@repo/design-system/components/evilcharts/ui/chart-config";

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

/** Horizontal left-to-right color gradient for multi-stop line and dot paints. */
export const HorizontalColorGradient = ({
  id,
  dataKey,
  config,
}: StyleProps & { config: ChartConfig }) => {
  const colorsCount = getColorsCount(config[dataKey] ?? {});

  return (
    <linearGradient
      gradientUnits="userSpaceOnUse"
      id={getChartSeriesId(id, "line-colors", dataKey)}
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

/** Soft outer-glow filter applied to a glowing line. */
export const LineGlowFilter = ({ id }: { id: string }) => (
  <filter height="200%" id={`${id}-glow`} width="200%" x="-50%" y="-50%">
    <feGaussianBlur in="SourceGraphic" result="blur" stdDeviation="10" />
    <feColorMatrix
      in="blur"
      result="glow"
      type="matrix"
      values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 2 0"
    />
    <feMerge>
      <feMergeNode in="glow" />
      <feMergeNode in="SourceGraphic" />
    </feMerge>
  </filter>
);
