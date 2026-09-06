"use client";

import { useReducedMotion } from "@mantine/hooks";
import {
  AnimatedDashedStroke,
  type AreaAnimationType,
  AreaPaint,
  type AreaVariant,
} from "@repo/design-system/components/evilcharts/charts/area/paint";
import {
  type CurveType,
  useAreaChart,
} from "@repo/design-system/components/evilcharts/charts/area-chart";
import {
  getChartSeriesPaint,
  getColorsCount,
} from "@repo/design-system/components/evilcharts/ui/chart-config";
import {
  ChartDot,
  type DotVariant,
} from "@repo/design-system/components/evilcharts/ui/dot";
import {
  Children,
  type ComponentProps,
  type FC,
  isValidElement,
  type ReactNode,
  useId,
} from "react";
import { Area as RechartsArea } from "recharts";

const STROKE_WIDTH = 0.8;
const STACK_ID = "evil-stacked";
type AreaDotProp = ComponentProps<typeof RechartsArea>["dot"];
type AreaActiveDotProp = ComponentProps<typeof RechartsArea>["activeDot"];
type StrokeVariant = "solid" | "dashed" | "animated-dashed";

interface AreaProps {
  animationType?: AreaAnimationType; // intro reveal ; falls back to the chart default
  areaProps?: Omit<ComponentProps<typeof RechartsArea>, "dataKey">; // escape hatch for raw Recharts Area props
  children?: ReactNode; // optional <Dot /> and <ActiveDot /> composition
  connectNulls?: boolean; // join segments across null/missing values
  curveType?: CurveType; // curve interpolation ; falls back to the chart default
  dataKey: string; // series key ; must exist on the data and config
  isClickable?: boolean; // lets this area be selected by clicking it
  strokeVariant?: StrokeVariant; // stroke style for this area
  variant?: AreaVariant; // fill style for this area only
}

/**
 * A single area series. Each <Area /> is fully self-contained: it generates its
 * own gradient/pattern definitions under a unique id, so any number of areas ;
 * each with its own variant, stroke, and clickability ; can live in one chart
 * without style collisions. Compose <Dot /> and <ActiveDot /> inside it to add
 * point markers.
 */
export function Area({
  dataKey,
  variant = "gradient",
  strokeVariant = "dashed",
  curveType,
  animationType,
  connectNulls = false,
  isClickable = false,
  children,
  areaProps,
}: AreaProps) {
  const {
    config,
    curveType: defaultCurve,
    animationType: defaultAnimation,
    isStacked,
    isExpanded,
    isLoading,
    selectedDataKey,
    selectDataKey,
  } = useAreaChart();
  const id = useId().replace(/:/g, ""); // unique id scopes this area's style defs
  // Devices set to "reduce motion" skip the intro reveal entirely
  const shouldReduceMotion = useReducedMotion();

  // The root renders the skeleton area while loading, so real areas step aside
  if (isLoading) {
    return null;
  }

  const resolvedCurve = curveType ?? defaultCurve;

  // The reveal is an animated SVG mask ; heavier than a static chart ; so
  // `"none"` and the OS reduce-motion preference both opt out of it.
  const revealType: AreaAnimationType = shouldReduceMotion
    ? "none"
    : (animationType ?? defaultAnimation);
  const maskId = revealType === "none" ? undefined : `${id}-reveal-mask`;

  const isSelected = selectedDataKey === dataKey;
  const hasSelection = selectedDataKey !== null;
  const opacity = getOpacity(selectedDataKey, dataKey);
  const showUnselected = hasSelection && !isSelected;
  const colorsCount = getColorsCount(config[dataKey] ?? {});

  const { dot, activeDot } = resolveDots(
    children,
    id,
    dataKey,
    opacity.dot,
    maskId
  );

  const isAnimatedDashed =
    !shouldReduceMotion && strokeVariant === "animated-dashed";
  const isDashed = strokeVariant !== "solid";

  return (
    <>
      <RechartsArea
        activeDot={activeDot}
        connectNulls={connectNulls}
        dataKey={dataKey}
        dot={dot}
        fill={getFillPattern(variant, showUnselected, id)}
        fillOpacity={opacity.fill}
        // Recharts' built-in area animation is permanently disabled ; it drew
        // the line after the dots had already popped in. The motion.dev reveal
        // mask drives the intro instead, wiping fill, stroke, and dots in together.
        isAnimationActive={false}
        onClick={() => {
          if (!isClickable) {
            return;
          }
          // Clicking the selected area clears the selection, otherwise selects it
          selectDataKey(isSelected ? null : dataKey);
        }}
        stackId={isStacked ? STACK_ID : undefined}
        stroke={getChartSeriesPaint(id, "colors", dataKey, colorsCount)}
        strokeDasharray={isDashed ? "3 3" : undefined}
        strokeOpacity={opacity.stroke}
        strokeWidth={STROKE_WIDTH}
        style={{
          ...(maskId ? { mask: `url(#${maskId})` } : {}),
          ...(isClickable ? { cursor: "pointer" } : {}),
        }}
        type={resolvedCurve}
        {...areaProps}
      >
        {isAnimatedDashed && !hasSelection && <AnimatedDashedStroke />}
      </RechartsArea>
      <AreaPaint
        config={config}
        dataKey={dataKey}
        id={id}
        isExpanded={isExpanded}
        revealType={revealType}
        showUnselected={showUnselected}
        variant={variant}
      />
    </>
  );
}

interface DotProps {
  variant?: DotVariant; // visual style of the point marker
}

/**
 * Declares a resting point marker for the <Area /> it is composed inside.
 * It renders nothing on its own ; the parent <Area /> reads its variant and
 * wires it into the Recharts dot slot.
 */
export const Dot: FC<DotProps> = () => null;

/**
 * Declares the hovered/active point marker for the <Area /> it is composed
 * inside. Like <Dot />, it is a configuration slot and renders nothing itself.
 */
export const ActiveDot: FC<DotProps> = () => null;

// Returns fill/stroke/dot opacity ; dims a series only when another is selected
const getOpacity = (selectedDataKey: string | null, dataKey: string) => {
  if (selectedDataKey === null) {
    return { fill: 0.8, stroke: 0.8, dot: 1 };
  }

  return selectedDataKey === dataKey
    ? { fill: 0.8, stroke: 0.8, dot: 1 }
    : { fill: 0.2, stroke: 0.3, dot: 0.3 };
};

// Resolves the SVG paint reference for an area's fill based on its variant
const getFillPattern = (
  variant: AreaVariant,
  showUnselected: boolean,
  id: string
): string => {
  // A non-selected area in a clickable chart is striped to recede visually
  if (showUnselected) {
    return `url(#${id}-unselected)`;
  }

  return `url(#${id}-${variant})`;
};

// Pulls <Dot /> and <ActiveDot /> out of an area's children into Recharts dot slots.
// When a `maskId` is given the resting dot is wired to the intro reveal mask so it
// wipes in with the line; the active dot is always left unmasked since it only
// appears on hover, after the intro has finished.
const resolveDots = (
  children: ReactNode,
  id: string,
  dataKey: string,
  dotOpacity: number,
  maskId: string | undefined
): { dot: AreaDotProp; activeDot: AreaActiveDotProp } => {
  let dot: AreaDotProp = false;
  let activeDot: AreaActiveDotProp = false;

  Children.forEach(children, (child) => {
    if (!isValidElement<DotProps>(child)) {
      return;
    }

    if (child.type === Dot) {
      const { variant } = child.props;
      dot = (
        <ChartDot
          chartId={id}
          dataKey={dataKey}
          fillOpacity={dotOpacity}
          maskId={maskId}
          type={variant}
        />
      );
    }

    if (child.type === ActiveDot) {
      const { variant } = child.props;
      activeDot = (
        <ChartDot
          chartId={id}
          dataKey={dataKey}
          fillOpacity={dotOpacity}
          type={variant}
        />
      );
    }
  });

  return { dot, activeDot };
};
