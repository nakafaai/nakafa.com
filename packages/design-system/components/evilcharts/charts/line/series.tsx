"use client";

import { useReducedMotion } from "@mantine/hooks";
import { bufferLineShape } from "@repo/design-system/components/evilcharts/charts/line/buffer";
import {
  AnimatedDashedStroke,
  ColorGradient,
  GlowFilter,
  type LineAnimationType,
} from "@repo/design-system/components/evilcharts/charts/line/paint";
import {
  type CurveType,
  STROKE_WIDTH,
  useLineChart,
} from "@repo/design-system/components/evilcharts/charts/line-chart";
import {
  getChartSeriesId,
  getChartSeriesPaint,
  getColorsCount,
} from "@repo/design-system/components/evilcharts/ui/chart-config";
import {
  ChartDot,
  type DotVariant,
} from "@repo/design-system/components/evilcharts/ui/dot";
import { RevealMask } from "@repo/design-system/components/evilcharts/ui/reveal";
import {
  Children,
  type ComponentProps,
  type FC,
  isValidElement,
  type ReactNode,
  useId,
} from "react";
import { Line as RechartsLine } from "recharts";

type StrokeVariant = "solid" | "dashed" | "animated-dashed";

// Composible parts

interface LineProps {
  animationType?: LineAnimationType; // intro reveal, falls back to the chart default
  children?: ReactNode; // optional <Dot /> and <ActiveDot /> composition
  connectNulls?: boolean; // join segments across null/missing values
  curveType?: CurveType; // curve interpolation, falls back to the chart default
  dataKey: string; // series key, must exist on the data and config
  enableBufferLine?: boolean; // renders this line's last segment as a dashed buffer
  glowing?: boolean; // applies a soft outer glow to this line
  isClickable?: boolean; // lets this line be selected by clicking it
  lineProps?: ComponentProps<typeof RechartsLine>; // escape hatch for raw Recharts Line props
  strokeVariant?: StrokeVariant; // stroke style for this line only
}

/**
 * A single line series. Each <Line /> is fully self-contained: it generates its
 * own gradient and glow definitions under a unique id, so any number of lines,
 * each with its own stroke, glow, and clickability, can live in one chart
 * without style collisions. Compose <Dot /> and <ActiveDot /> inside it to add
 * point markers.
 */
export function Line({
  dataKey,
  strokeVariant = "solid",
  curveType,
  animationType,
  connectNulls = false,
  isClickable = false,
  glowing = false,
  enableBufferLine = false,
  children,
  lineProps,
}: LineProps) {
  const {
    config,
    curveType: defaultCurve,
    animationType: defaultAnimation,
    isLoading,
    selectedDataKey,
    selectDataKey,
  } = useLineChart();
  const id = useId().replace(/:/g, ""); // unique id scopes this line's style defs
  // Devices set to "reduce motion" skip the intro reveal entirely
  const shouldReduceMotion = useReducedMotion();

  // The root renders the skeleton line while loading, so real lines step aside
  if (isLoading) {
    return null;
  }

  const resolvedCurve = curveType ?? defaultCurve;

  // The reveal is an animated SVG mask, heavier than a static chart, so
  // `"none"` and the OS reduce-motion preference both opt out of it.
  const revealType: LineAnimationType = shouldReduceMotion
    ? "none"
    : (animationType ?? defaultAnimation);
  const maskId = revealType === "none" ? undefined : `${id}-reveal-mask`;

  const isSelected = selectedDataKey === dataKey;
  const hasSelection = selectedDataKey !== null;
  const opacity = getOpacity(selectedDataKey, dataKey);
  const colorsCount = getColorsCount(config[dataKey] ?? {});

  const { dot, activeDot } = resolveDots(children);

  const isAnimatedDashed =
    !shouldReduceMotion && strokeVariant === "animated-dashed";
  const isDashed = strokeVariant !== "solid";

  return (
    <>
      <g key={dataKey}>
        {isClickable && (
          <RechartsLine
            activeDot={false}
            connectNulls={connectNulls}
            dataKey={dataKey}
            dot={false}
            isAnimationActive={false}
            legendType="none"
            onClick={() => selectDataKey(isSelected ? null : dataKey)}
            stroke="transparent"
            strokeWidth={15}
            style={{ cursor: "pointer" }}
            tooltipType="none"
            type={resolvedCurve}
          />
        )}
        <RechartsLine
          activeDot={
            activeDot ? (
              <ChartDot
                chartId={id}
                dataKey={dataKey}
                fillOpacity={opacity.dot}
                type={activeDot.variant}
              />
            ) : (
              false
            )
          }
          connectNulls={connectNulls}
          dataKey={dataKey}
          dot={
            dot ? (
              <ChartDot
                chartId={id}
                dataKey={dataKey}
                fillOpacity={opacity.dot}
                maskId={maskId}
                type={dot.variant}
              />
            ) : (
              false
            )
          }
          filter={
            glowing
              ? `url(#${getChartSeriesId(id, "glow", dataKey)})`
              : undefined
          }
          // Recharts' built-in line animation is permanently disabled, it drew
          // the line after the dots had already popped in. The motion.dev reveal
          // mask drives the intro instead, wiping stroke and dots in together.
          isAnimationActive={false}
          onClick={() => {
            if (!isClickable) {
              return;
            }
            // Clicking the selected line clears the selection, otherwise selects it
            selectDataKey(isSelected ? null : dataKey);
          }}
          shape={enableBufferLine ? bufferLineShape : undefined}
          stroke={getChartSeriesPaint(id, "colors", dataKey, colorsCount)}
          strokeDasharray={getStrokeDasharray(enableBufferLine, isDashed)}
          strokeOpacity={opacity.stroke}
          strokeWidth={STROKE_WIDTH}
          style={{
            ...(maskId ? { mask: `url(#${maskId})` } : {}),
            ...(isClickable ? { cursor: "pointer" } : {}),
          }}
          type={resolvedCurve}
          {...lineProps}
        >
          {isAnimatedDashed && !hasSelection && <AnimatedDashedStroke />}
        </RechartsLine>
      </g>
      <defs>
        {revealType !== "none" && <RevealMask id={id} type={revealType} />}
        <ColorGradient config={config} dataKey={dataKey} id={id} />
        {glowing && <GlowFilter dataKey={dataKey} id={id} />}
      </defs>
    </>
  );
}

interface DotProps {
  variant?: DotVariant; // visual style of the point marker
}

/**
 * Declares a resting point marker for the <Line /> it is composed inside.
 * It renders nothing on its own, the parent <Line /> reads its variant and
 * wires it into the Recharts dot slot.
 */
export const Dot: FC<DotProps> = () => null;

/**
 * Declares the hovered/active point marker for the <Line /> it is composed
 * inside. Like <Dot />, it is a configuration slot and renders nothing itself.
 */
export const ActiveDot: FC<DotProps> = () => null;

// Selection + dot helpers

// Returns stroke/dot opacity, dims a series only when another is selected
const getOpacity = (selectedDataKey: string | null, dataKey: string) => {
  if (selectedDataKey === null) {
    return { stroke: 1, dot: 1 };
  }

  return selectedDataKey === dataKey
    ? { stroke: 1, dot: 1 }
    : { stroke: 0.3, dot: 0.3 };
};

// Resolves a line's stroke-dasharray, the buffer line manages its own dashes
const getStrokeDasharray = (enableBufferLine: boolean, isDashed: boolean) => {
  if (enableBufferLine) {
    return;
  }

  return isDashed ? "5 5" : undefined;
};

// Reads marker configuration; the series owns the Recharts rendering slots.
const resolveDots = (children: ReactNode) => {
  let dot: DotProps | undefined;
  let activeDot: DotProps | undefined;

  Children.forEach(children, (child) => {
    if (!isValidElement<DotProps>(child)) {
      return;
    }

    if (child.type === Dot) {
      dot = child.props;
    }

    if (child.type === ActiveDot) {
      activeDot = child.props;
    }
  });

  return { dot, activeDot };
};
