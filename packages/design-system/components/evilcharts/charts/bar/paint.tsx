"use client";

import {
  type ChartConfig,
  getChartColorVariable,
  getChartSeriesId,
  getColorsCount,
} from "@repo/design-system/components/evilcharts/ui/chart-config";

export type BarVariant =
  | "default"
  | "hatched"
  | "duotone"
  | "duotone-reverse"
  | "gradient"
  | "stripped";

// Style definitions, one set per <Bar />, scoped to its unique id

interface StyleProps {
  dataKey: string; // series key the colors belong to
  id: string; // unique id of the owning <Bar />
}

/**
 * Vertical top-to-bottom color gradient for a series. Always rendered, every
 * fill variant and the buffer-bar stroke paint from this single gradient.
 */
export const ColorGradient = ({
  id,
  dataKey,
  config,
}: StyleProps & { config: ChartConfig }) => {
  const colorsCount = getColorsCount(config[dataKey] ?? {});

  return (
    <linearGradient
      id={getChartSeriesId(id, "colors", dataKey)}
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
  );
};

/** Diagonal hatched-stripe fill, masked from the series color gradient. */
export const HatchedPattern = ({ id, dataKey }: StyleProps) => (
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
    <mask id={getChartSeriesId(id, "hatched-mask", dataKey)}>
      <rect
        fill={`url(#${id}-hatched-mask-pattern)`}
        height="100%"
        width="100%"
      />
    </mask>
    <pattern
      height="100%"
      id={getChartSeriesId(id, "hatched", dataKey)}
      patternUnits="userSpaceOnUse"
      width="100%"
    >
      <rect
        fill={`url(#${getChartSeriesId(id, "colors", dataKey)})`}
        height="100%"
        mask={`url(#${getChartSeriesId(id, "hatched-mask", dataKey)})`}
        width="100%"
      />
    </pattern>
  </>
);

/** Hatched diagonal lines with no background fill, used for the buffer bar. */
export const BufferHatchedPattern = ({ id, dataKey }: StyleProps) => (
  <>
    <pattern
      height="5"
      id={`${id}-buffer-hatched-mask-pattern`}
      patternTransform="rotate(-45)"
      patternUnits="userSpaceOnUse"
      width="5"
      x="0"
      y="0"
    >
      <rect fill="black" fillOpacity={0} height="5" width="5" />
      <rect fill="white" fillOpacity={1} height="5" width="1" />
    </pattern>
    <mask id={getChartSeriesId(id, "buffer-hatched-mask", dataKey)}>
      <rect
        fill={`url(#${id}-buffer-hatched-mask-pattern)`}
        height="100%"
        width="100%"
      />
    </mask>
    <pattern
      height="100%"
      id={getChartSeriesId(id, "buffer-hatched", dataKey)}
      patternUnits="userSpaceOnUse"
      width="100%"
    >
      <rect
        fill={`url(#${getChartSeriesId(id, "colors", dataKey)})`}
        height="100%"
        mask={`url(#${getChartSeriesId(id, "buffer-hatched-mask", dataKey)})`}
        width="100%"
      />
    </pattern>
  </>
);

/** Two-tone fill, a half-faded, half-solid split applied per bar bounding box. */
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
        id={getChartSeriesId(id, `${variant}-mask-gradient`, dataKey)}
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
        id={getChartSeriesId(id, `${variant}-colors`, dataKey)}
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
      <mask
        id={getChartSeriesId(id, `${variant}-mask`, dataKey)}
        maskContentUnits="objectBoundingBox"
      >
        <rect
          fill={`url(#${getChartSeriesId(id, `${variant}-mask-gradient`, dataKey)})`}
          height="1"
          width="1"
          x="0"
          y="0"
        />
      </mask>
      <pattern
        height="1"
        id={getChartSeriesId(id, variant, dataKey)}
        patternContentUnits="objectBoundingBox"
        patternUnits="objectBoundingBox"
        width="1"
      >
        <rect
          fill={`url(#${getChartSeriesId(id, `${variant}-colors`, dataKey)})`}
          height="1"
          mask={`url(#${getChartSeriesId(id, `${variant}-mask`, dataKey)})`}
          width="1"
          x="0"
          y="0"
        />
      </pattern>
    </>
  );
};

/** Gradient fill that fades the series color from solid at the top to clear. */
export const GradientPattern = ({ id, dataKey }: StyleProps) => (
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
    <mask id={getChartSeriesId(id, "gradient-mask", dataKey)}>
      <rect
        fill={`url(#${id}-gradient-mask-gradient)`}
        height="100%"
        width="100%"
      />
    </mask>
    <pattern
      height="100%"
      id={getChartSeriesId(id, "gradient", dataKey)}
      patternUnits="userSpaceOnUse"
      width="100%"
    >
      <rect
        fill={`url(#${getChartSeriesId(id, "colors", dataKey)})`}
        height="100%"
        mask={`url(#${getChartSeriesId(id, "gradient-mask", dataKey)})`}
        width="100%"
      />
    </pattern>
  </>
);

/** Low-opacity body fill, paired with a solid top strip drawn by CustomBar. */
export const StrippedPattern = ({ id, dataKey }: StyleProps) => (
  <>
    <linearGradient
      id={`${id}-stripped-mask-gradient`}
      x1="0"
      x2="0"
      y1="0"
      y2="1"
    >
      <stop offset="0%" stopColor="white" stopOpacity={0.2} />
      <stop offset="100%" stopColor="white" stopOpacity={0.2} />
    </linearGradient>
    <mask id={getChartSeriesId(id, "stripped-mask", dataKey)}>
      <rect
        fill={`url(#${id}-stripped-mask-gradient)`}
        height="100%"
        width="100%"
      />
    </mask>
    <pattern
      height="100%"
      id={getChartSeriesId(id, "stripped", dataKey)}
      patternUnits="userSpaceOnUse"
      width="100%"
    >
      <rect
        fill={`url(#${getChartSeriesId(id, "colors", dataKey)})`}
        height="100%"
        mask={`url(#${getChartSeriesId(id, "stripped-mask", dataKey)})`}
        width="100%"
      />
    </pattern>
  </>
);

/** Soft outer-glow filter applied to a glowing bar. */
export const GlowFilter = ({ id, dataKey }: StyleProps) => (
  <filter
    height="300%"
    id={getChartSeriesId(id, "bar-glow", dataKey)}
    width="300%"
    x="-100%"
    y="-100%"
  >
    <feGaussianBlur in="SourceGraphic" result="blur" stdDeviation="8" />
    <feColorMatrix
      in="blur"
      result="glow"
      type="matrix"
      values="1 0 0 0 0
                0 1 0 0 0
                0 0 1 0 0
                0 0 0 0.5 0"
    />
    <feMerge>
      <feMergeNode in="glow" />
      <feMergeNode in="SourceGraphic" />
    </feMerge>
  </filter>
);
