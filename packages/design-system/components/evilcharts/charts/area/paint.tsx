"use client";

import {
  type ChartConfig,
  getChartColorVariable,
  getChartSeriesId,
  getColorsCount,
} from "@repo/design-system/components/evilcharts/ui/chart-config";
import { RevealMask } from "@repo/design-system/components/evilcharts/ui/reveal";
import type { OrderedRevealAnimation } from "@repo/design-system/components/evilcharts/ui/reveal-animation";

export type AreaAnimationType = "none" | OrderedRevealAnimation;

interface StyleProps {
  dataKey: string; // series key the colors belong to
  id: string; // unique id of the owning <Area />
}
export const AnimatedDashedStroke = () => (
  <>
    <animate
      attributeName="stroke-dasharray"
      dur="1s"
      keyTimes="0;0.5;1"
      repeatCount="indefinite"
      values="3 3; 0 3; 3 3"
    />
    <animate
      attributeName="stroke-dashoffset"
      dur="1s"
      keyTimes="0;1"
      repeatCount="indefinite"
      values="0; -6"
    />
  </>
);

const ColorGradient = ({
  id,
  dataKey,
  config,
  isExpanded,
}: StyleProps & { config: ChartConfig; isExpanded: boolean }) => {
  const colorsCount = getColorsCount(config[dataKey] ?? {});

  return (
    <linearGradient
      gradientUnits={isExpanded ? "userSpaceOnUse" : "objectBoundingBox"}
      id={getChartSeriesId(id, "colors", dataKey)}
      x1="0"
      x2="1"
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

const GradientPattern = ({ id, dataKey }: StyleProps) => (
  <>
    <linearGradient id={`${id}-vertical-fade`} x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stopColor="white" stopOpacity={0.1} />
      <stop offset="100%" stopColor="white" stopOpacity={0} />
    </linearGradient>
    <mask id={`${id}-gradient-mask`}>
      <rect fill={`url(#${id}-vertical-fade)`} height="100%" width="100%" />
    </mask>
    <pattern
      height="100%"
      id={`${id}-gradient`}
      patternUnits="userSpaceOnUse"
      width="100%"
    >
      <rect
        fill={`url(#${getChartSeriesId(id, "colors", dataKey)})`}
        height="100%"
        mask={`url(#${id}-gradient-mask)`}
        width="100%"
      />
    </pattern>
  </>
);

const ReverseGradientPattern = ({ id, dataKey }: StyleProps) => (
  <>
    <linearGradient
      id={`${id}-vertical-fade-reverse`}
      x1="0"
      x2="0"
      y1="0"
      y2="1"
    >
      <stop offset="0%" stopColor="white" stopOpacity={0} />
      <stop offset="100%" stopColor="white" stopOpacity={0.1} />
    </linearGradient>
    <mask id={`${id}-gradient-reverse-mask`}>
      <rect
        fill={`url(#${id}-vertical-fade-reverse)`}
        height="100%"
        width="100%"
      />
    </mask>
    <pattern
      height="100%"
      id={`${id}-gradient-reverse`}
      patternUnits="userSpaceOnUse"
      width="100%"
    >
      <rect
        fill={`url(#${getChartSeriesId(id, "colors", dataKey)})`}
        height="100%"
        mask={`url(#${id}-gradient-reverse-mask)`}
        width="100%"
      />
    </pattern>
  </>
);

const SolidPattern = ({ id, dataKey }: StyleProps) => (
  <>
    <linearGradient id={`${id}-solid-fade`} x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stopColor="white" stopOpacity={0.1} />
      <stop offset="100%" stopColor="white" stopOpacity={0.1} />
    </linearGradient>
    <mask id={`${id}-solid-mask`}>
      <rect fill={`url(#${id}-solid-fade)`} height="100%" width="100%" />
    </mask>
    <pattern
      height="100%"
      id={`${id}-solid`}
      patternUnits="userSpaceOnUse"
      width="100%"
    >
      <rect
        fill={`url(#${getChartSeriesId(id, "colors", dataKey)})`}
        height="100%"
        mask={`url(#${id}-solid-mask)`}
        width="100%"
      />
    </pattern>
  </>
);

const LinesPattern = ({ id, dataKey }: StyleProps) => (
  <>
    <pattern
      height="5"
      id={`${id}-lines-texture`}
      patternTransform="rotate(45)"
      patternUnits="userSpaceOnUse"
      width="5"
    >
      <line stroke="white" strokeWidth="1" x1="0" x2="0" y1="0" y2="5" />
    </pattern>
    <mask id={`${id}-lines-mask`}>
      <rect
        fill={`url(#${id}-lines-texture)`}
        fillOpacity="0.3"
        height="100%"
        width="100%"
      />
    </mask>
    <pattern
      height="100%"
      id={`${id}-lines`}
      patternUnits="userSpaceOnUse"
      width="100%"
    >
      <rect
        fill={`url(#${getChartSeriesId(id, "colors", dataKey)})`}
        height="100%"
        mask={`url(#${id}-lines-mask)`}
        width="100%"
      />
    </pattern>
  </>
);

const DottedPattern = ({ id, dataKey }: StyleProps) => (
  <>
    <pattern
      height="6"
      id={`${id}-dotted-texture`}
      patternUnits="userSpaceOnUse"
      width="6"
      x="0"
      y="0"
    >
      <circle cx="4" cy="4" fill="white" r="0.5" />
    </pattern>
    <mask id={`${id}-dotted-mask`}>
      <rect
        fill={`url(#${id}-dotted-texture)`}
        fillOpacity="0.5"
        height="100%"
        width="100%"
      />
    </mask>
    <pattern
      height="100%"
      id={`${id}-dotted`}
      patternUnits="userSpaceOnUse"
      width="100%"
    >
      <rect
        fill={`url(#${getChartSeriesId(id, "colors", dataKey)})`}
        height="100%"
        mask={`url(#${id}-dotted-mask)`}
        width="100%"
      />
    </pattern>
  </>
);

const HatchedPattern = ({ id, dataKey }: StyleProps) => (
  <>
    <linearGradient id={`${id}-hatched-stripe`} x1="0" x2="1" y1="0" y2="0">
      <stop offset="50%" stopColor="white" stopOpacity={0.2} />
      <stop offset="50%" stopColor="white" stopOpacity={1} />
    </linearGradient>
    <pattern
      height="10"
      id={`${id}-hatched-texture`}
      overflow="visible"
      patternTransform="rotate(20)"
      patternUnits="userSpaceOnUse"
      width="20"
      x="0"
      y="0"
    >
      <rect fill={`url(#${id}-hatched-stripe)`} height="10" width="20" />
    </pattern>
    <mask id={`${id}-hatched-mask`}>
      <rect
        fill={`url(#${id}-hatched-texture)`}
        fillOpacity="0.2"
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
        fill={`url(#${getChartSeriesId(id, "colors", dataKey)})`}
        height="100%"
        mask={`url(#${id}-hatched-mask)`}
        width="100%"
      />
    </pattern>
  </>
);

const UnselectedPattern = ({ id, dataKey }: StyleProps) => (
  <>
    <pattern
      height="5"
      id={`${id}-unselected-texture`}
      patternTransform="rotate(45)"
      patternUnits="userSpaceOnUse"
      width="5"
    >
      <line stroke="white" strokeWidth="1" x1="0" x2="0" y1="0" y2="5" />
    </pattern>
    <mask id={`${id}-unselected-mask`}>
      <rect
        fill={`url(#${id}-unselected-texture)`}
        fillOpacity="0.3"
        height="100%"
        width="100%"
      />
    </mask>
    <pattern
      height="100%"
      id={`${id}-unselected`}
      patternUnits="userSpaceOnUse"
      width="100%"
    >
      <rect
        fill={`url(#${getChartSeriesId(id, "colors", dataKey)})`}
        height="100%"
        mask={`url(#${id}-unselected-mask)`}
        width="100%"
      />
    </pattern>
  </>
);

const FILL_PATTERNS = {
  gradient: GradientPattern,
  "gradient-reverse": ReverseGradientPattern,
  solid: SolidPattern,
  dotted: DottedPattern,
  lines: LinesPattern,
  hatched: HatchedPattern,
};
export type AreaVariant = keyof typeof FILL_PATTERNS;

/** Owns each series' color, fill texture, selection paint, and synchronized reveal. */
export function AreaPaint({
  config,
  dataKey,
  id,
  isExpanded,
  revealType,
  showUnselected,
  variant,
}: StyleProps & {
  config: ChartConfig;
  isExpanded: boolean;
  revealType: AreaAnimationType;
  showUnselected: boolean;
  variant: AreaVariant;
}) {
  const Pattern = FILL_PATTERNS[variant];
  return (
    <defs>
      {revealType !== "none" && <RevealMask id={id} type={revealType} />}
      <ColorGradient
        config={config}
        dataKey={dataKey}
        id={id}
        isExpanded={isExpanded}
      />
      <Pattern dataKey={dataKey} id={id} />
      {showUnselected && <UnselectedPattern dataKey={dataKey} id={id} />}
    </defs>
  );
}
