"use client";

import {
  type ChartConfig,
  getChartColorVariable,
  getColorsCount,
} from "@repo/design-system/components/evilcharts/ui/chart-config";

export type BarVariant =
  | "default"
  | "hatched"
  | "duotone"
  | "duotone-reverse"
  | "gradient"
  | "stripped";

// Style definitions, one set per <Bar /> / <Line />, scoped to its unique id

export interface StyleProps {
  dataKey: string; // series key the colors belong to
  id: string; // unique id of the owning series
}

/** Vertical top-to-bottom color gradient, the fill source for every bar variant. */
export const VerticalColorGradient = ({
  id,
  dataKey,
  config,
}: StyleProps & { config: ChartConfig }) => {
  const colorsCount = getColorsCount(config[dataKey] ?? {});

  return (
    <linearGradient id={`${id}-bar-colors`} x1="0" x2="0" y1="0" y2="1">
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

/** Hatched diagonal-stripe fill for a bar, masked from the series color gradient. */
export const HatchedPattern = ({ id }: StyleProps) => (
  <>
    <pattern
      height="5"
      id={`${id}-hatched-mask-pattern`}
      patternTransform="rotate(-45)"
      patternUnits="userSpaceOnUse"
      width="5"
      x="0"
      y="0"
    >
      <rect fill="white" fillOpacity={0.3} height="5" width="5" />
      <rect fill="white" fillOpacity={1} height="5" width="1.5" />
    </pattern>
    <mask id={`${id}-hatched-mask`}>
      <rect
        fill={`url(#${id}-hatched-mask-pattern)`}
        height="100%"
        width="100%"
      />
    </mask>
    <pattern
      height="100%"
      id={`${id}-hatched`}
      patternUnits="userSpaceOnUse"
      width="100%"
    >
      <rect
        fill={`url(#${id}-bar-colors)`}
        height="100%"
        mask={`url(#${id}-hatched-mask)`}
        width="100%"
      />
    </pattern>
  </>
);

/** Two-tone fill that splits each bar into a light and a full-strength half. */
export const DuotonePattern = ({
  id,
  dataKey,
  config,
  variant,
}: StyleProps & {
  config: ChartConfig;
  variant: "duotone" | "duotone-reverse";
}) => {
  const colorsCount = getColorsCount(config[dataKey] ?? {});

  return (
    <>
      <linearGradient
        gradientUnits="objectBoundingBox"
        id={`${id}-${variant}-mask-gradient`}
        x1="0"
        x2="1"
        y1="0"
        y2="0"
      >
        <stop
          offset="50%"
          stopColor="white"
          stopOpacity={variant === "duotone" ? 0.4 : 1}
        />
        <stop
          offset="50%"
          stopColor="white"
          stopOpacity={variant === "duotone" ? 1 : 0.4}
        />
      </linearGradient>
      <linearGradient
        gradientUnits="objectBoundingBox"
        id={`${id}-${variant}-colors`}
        x1="0"
        x2="0"
        y1="0"
        y2="1"
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
      <mask id={`${id}-${variant}-mask`} maskContentUnits="objectBoundingBox">
        <rect
          fill={`url(#${id}-${variant}-mask-gradient)`}
          height="1"
          width="1"
          x="0"
          y="0"
        />
      </mask>
      <pattern
        height="1"
        id={`${id}-${variant}`}
        patternContentUnits="objectBoundingBox"
        patternUnits="objectBoundingBox"
        width="1"
      >
        <rect
          fill={`url(#${id}-${variant}-colors)`}
          height="1"
          mask={`url(#${id}-${variant}-mask)`}
          width="1"
          x="0"
          y="0"
        />
      </pattern>
    </>
  );
};

/** Gradient fill for a bar that fades from visible at the top toward transparent. */
export const GradientPattern = ({ id }: StyleProps) => (
  <>
    <linearGradient
      id={`${id}-gradient-mask-gradient`}
      x1="0"
      x2="0"
      y1="0"
      y2="1"
    >
      <stop offset="20%" stopColor="white" stopOpacity={1} />
      <stop offset="90%" stopColor="white" stopOpacity={0} />
    </linearGradient>
    <mask id={`${id}-gradient-mask`}>
      <rect
        fill={`url(#${id}-gradient-mask-gradient)`}
        height="100%"
        width="100%"
      />
    </mask>
    <pattern
      height="100%"
      id={`${id}-gradient`}
      patternUnits="userSpaceOnUse"
      width="100%"
    >
      <rect
        fill={`url(#${id}-bar-colors)`}
        height="100%"
        mask={`url(#${id}-gradient-mask)`}
        width="100%"
      />
    </pattern>
  </>
);

/** Low-opacity gradient fill paired with the solid top strip drawn by `CustomBar`. */
export const StrippedPattern = ({ id }: StyleProps) => (
  <>
    <linearGradient
      id={`${id}-stripped-mask-gradient`}
      x1="0"
      x2="0"
      y1="0"
      y2="1"
    >
      <stop offset="0%" stopColor="white" stopOpacity={0.4} />
      <stop offset="100%" stopColor="white" stopOpacity={0.1} />
    </linearGradient>
    <mask id={`${id}-stripped-mask`}>
      <rect
        fill={`url(#${id}-stripped-mask-gradient)`}
        height="100%"
        width="100%"
      />
    </mask>
    <pattern
      height="100%"
      id={`${id}-stripped`}
      patternUnits="userSpaceOnUse"
      width="100%"
    >
      <rect
        fill={`url(#${id}-bar-colors)`}
        height="100%"
        mask={`url(#${id}-stripped-mask)`}
        width="100%"
      />
    </pattern>
  </>
);

/** Soft outer-glow filter applied to a glowing bar. */
export const BarGlowFilter = ({ id }: { id: string }) => (
  <filter height="300%" id={`${id}-glow`} width="300%" x="-100%" y="-100%">
    <feGaussianBlur in="SourceGraphic" result="blur" stdDeviation="8" />
    <feColorMatrix
      in="blur"
      result="glow"
      type="matrix"
      values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.5 0"
    />
    <feMerge>
      <feMergeNode in="glow" />
      <feMergeNode in="SourceGraphic" />
    </feMerge>
  </filter>
);
