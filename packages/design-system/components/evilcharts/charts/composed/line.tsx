"use client";

import { useReducedMotion } from "@mantine/hooks";
import {
  AnimatedDashedStroke,
  HorizontalColorGradient,
  LineGlowFilter,
} from "@repo/design-system/components/evilcharts/charts/composed/lines";
import {
  type ComposedAnimationType,
  type CurveType,
  getOpacity,
  STROKE_WIDTH,
  useComposedChart,
} from "@repo/design-system/components/evilcharts/charts/composed-chart";
import {
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

interface LineProps {
  animationType?: ComposedAnimationType; // intro reveal, falls back to the chart default
  children?: ReactNode; // optional <Dot /> and <ActiveDot /> composition
  connectNulls?: boolean; // join segments across null/missing values
  curveType?: CurveType; // curve interpolation, falls back to the chart default
  dataKey: string; // series key, must exist on the data and config
  glow?: boolean; // applies a soft neon glow to this line
  isClickable?: boolean; // lets this line be selected by clicking it
  lineProps?: ComponentProps<typeof RechartsLine>; // escape hatch for raw Recharts Line props
  strokeVariant?: StrokeVariant; // stroke style for this line only
}

/**
 * A single line series. Each <Line /> is fully self-contained: it generates its
 * own color gradient and glow filter under a unique id, so any number of lines,
 * each with its own stroke, curve, glow, and clickability, can live in one chart
 * without style collisions. Compose <Dot /> and <ActiveDot /> inside it to add
 * point markers.
 */
export function Line({
  dataKey,
  strokeVariant = "solid",
  curveType,
  animationType,
  connectNulls = false,
  glow = false,
  isClickable = false,
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
  } = useComposedChart();
  const id = useId().replace(/:/g, ""); // unique id scopes this line's style defs
  // Devices set to "reduce motion" skip the intro reveal entirely
  const shouldReduceMotion = useReducedMotion();

  // The root renders the skeleton bar while loading, so real lines step aside
  if (isLoading) {
    return null;
  }

  const resolvedCurve = curveType ?? defaultCurve;

  // The reveal is an animated SVG mask, heavier than a static chart, so
  // `"none"` and the OS reduce-motion preference both opt out of it.
  const revealType: ComposedAnimationType = shouldReduceMotion
    ? "none"
    : (animationType ?? defaultAnimation);
  const maskId = revealType === "none" ? undefined : `${id}-reveal-mask`;

  const opacity = getOpacity(selectedDataKey, dataKey);
  const hasSelection = selectedDataKey !== null;
  const filter = glow ? `url(#${id}-glow)` : undefined;
  const colorsCount = getColorsCount(config[dataKey] ?? {});

  const { dot, activeDot } = resolveDots(children);

  const isAnimatedDashed =
    !shouldReduceMotion && strokeVariant === "animated-dashed";
  const isDashed = strokeVariant !== "solid";

  const handleLineClick = () => {
    if (!isClickable) {
      return;
    }
    selectDataKey(selectedDataKey === dataKey ? null : dataKey);
  };

  return (
    <>
      {isClickable && (
        <RechartsLine
          activeDot={false}
          connectNulls={connectNulls}
          dataKey={dataKey}
          dot={false}
          isAnimationActive={false}
          legendType="none"
          onClick={handleLineClick}
          stroke="transparent"
          strokeWidth={20}
          style={{ cursor: "pointer" }}
          tooltipType="none"
          type={resolvedCurve}
        />
      )}
      <RechartsLine
        activeDot={
          activeDot ? (
            <ChartDot
              chartId={`${id}-line`}
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
              chartId={`${id}-line`}
              dataKey={dataKey}
              fillOpacity={opacity.dot}
              maskId={maskId}
              type={dot.variant}
            />
          ) : (
            false
          )
        }
        filter={filter}
        // Recharts' built-in line animation is permanently disabled, the
        // motion.dev reveal mask drives the intro, wiping stroke and dots in together.
        isAnimationActive={false}
        stroke={getChartSeriesPaint(id, "line-colors", dataKey, colorsCount)}
        strokeDasharray={isDashed ? "5 5" : undefined}
        strokeOpacity={opacity.stroke}
        strokeWidth={STROKE_WIDTH}
        style={{
          ...(maskId ? { mask: `url(#${maskId})` } : {}),
          ...(isClickable ? { cursor: "pointer", pointerEvents: "none" } : {}),
        }}
        type={resolvedCurve}
        {...lineProps}
      >
        {isAnimatedDashed && !hasSelection && <AnimatedDashedStroke />}
      </RechartsLine>
      <defs>
        {revealType !== "none" && <RevealMask id={id} type={revealType} />}
        <HorizontalColorGradient config={config} dataKey={dataKey} id={id} />
        {glow && <LineGlowFilter id={id} />}
      </defs>
    </>
  );
}

export interface DotProps {
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
