"use client";

import { ChartContainer } from "@repo/design-system/components/evilcharts/ui/chart";
import {
  axisValueToPercentFormatter,
  type ChartConfig,
  getChartColorVariable,
  getChartSeriesId,
  getChartSeriesPaint,
  getColorsCount,
  getLoadingData,
} from "@repo/design-system/components/evilcharts/ui/chart-config";
import {
  ChartDot,
  type DotVariant,
} from "@repo/design-system/components/evilcharts/ui/dot";
import {
  EvilBrush,
  type EvilBrushRange,
  useEvilBrush,
} from "@repo/design-system/components/evilcharts/ui/evil-brush";
import {
  ChartLegend,
  ChartLegendContent,
  type ChartLegendVariant,
} from "@repo/design-system/components/evilcharts/ui/legend";
import { LoadingIndicator } from "@repo/design-system/components/evilcharts/ui/loading-indicator";
import {
  ChartTooltip,
  ChartTooltipContent,
  type TooltipRoundness,
  type TooltipVariant,
} from "@repo/design-system/components/evilcharts/ui/tooltip";
import { m, useReducedMotion } from "motion/react";
import {
  Children,
  type ComponentProps,
  createContext,
  type FC,
  isValidElement,
  type ReactElement,
  type ReactNode,
  use,
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CartesianGrid,
  Area as RechartsArea,
  AreaChart as RechartsAreaChart,
  XAxis as RechartsXAxis,
  YAxis as RechartsYAxis,
} from "recharts";

// Constants
const STROKE_WIDTH = 0.8;
const LOADING_AREA_DATA_KEY = "loading";
const LOADING_ANIMATION_DURATION = 2000; // in milliseconds
const STACK_ID = "evil-stacked";
const REVEAL_DURATION = 1; // intro wipe length, in seconds
const REVEAL_EASE: [number, number, number, number] = [0, 0.7, 0.5, 1]; // intro wipe easing
const REVEAL_PROPS = {
  animate: { scaleX: [0, 1] },
  transition: { duration: REVEAL_DURATION, ease: REVEAL_EASE },
};

type CurveType = ComponentProps<typeof RechartsArea>["type"];
type AreaDotProp = ComponentProps<typeof RechartsArea>["dot"];
type AreaActiveDotProp = ComponentProps<typeof RechartsArea>["activeDot"];
type AreaVariant =
  | "gradient"
  | "gradient-reverse"
  | "solid"
  | "dotted"
  | "lines"
  | "hatched";
type StrokeVariant = "solid" | "dashed" | "animated-dashed";
type StackType = "default" | "expanded" | "stacked";

/**
 * Direction of the custom motion.dev intro reveal. Recharts' own area animation
 * is permanently disabled (it drew the line after the dots had already popped
 * in) — these reveals replace it.
 *
 * NOTE: a reveal is a per-frame animated SVG mask, so it is heavier than a
 * static chart. `"none"` opts out entirely; it is also what a device with the
 * OS "reduce motion" preference falls back to automatically.
 */
type AreaAnimationType =
  | "none"
  | "left-to-right"
  | "right-to-left"
  | "center-out"
  | "edges-in";
type RevealAnimationType = Exclude<AreaAnimationType, "none">;

// ─────────────────────────────────────────────────────────────────────────────
// Shared context
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shared state for every part of the chart. Lifted into <EvilAreaChart /> so that
 * <Area />, <XAxis />, <Legend />, and friends can read it without prop drilling.
 * Sub-components are composed freely — the provider is the single source of truth.
 */
interface AreaChartContextValue {
  animationType: AreaAnimationType; // default intro reveal each <Area /> inherits
  config: ChartConfig; // colors + labels for every series
  curveType: CurveType; // default curve interpolation each <Area /> inherits
  isExpanded: boolean; // whether the stack is normalized to 100%
  isLoading: boolean; // whether the chart shows its loading skeleton
  isStacked: boolean; // whether areas stack on top of each other
  selectDataKey: (dataKey: string | null) => void; // sets the selected series
  selectedDataKey: string | null; // currently selected series, or null when none
}

const AreaChartContext = createContext<AreaChartContextValue | null>(null);

// Reads the chart context, throwing a helpful error when used outside <EvilAreaChart />
function useAreaChart() {
  const context = use(AreaChartContext);

  if (!context) {
    throw new Error(
      "Area chart parts (<Area />, <XAxis />, …) must be used within <EvilAreaChart />"
    );
  }

  return context;
}

// ─────────────────────────────────────────────────────────────────────────────
// Root container
// ─────────────────────────────────────────────────────────────────────────────

// Validates that every config key also exists on the data row type
type ValidateConfigKeys<TData, TConfig> = {
  [K in keyof TConfig]: K extends keyof TData ? ChartConfig[string] : never;
};

interface EvilAreaChartBaseProps<
  TData extends Record<string, unknown>,
  TConfig extends Record<string, ChartConfig[string]>,
> {
  animationType?: AreaAnimationType; // default intro reveal for every <Area />
  brushFormatLabel?: (value: unknown, index: number) => string; // formats brush axis labels
  brushHeight?: number; // height of the brush preview in pixels
  chartProps?: ComponentProps<typeof RechartsAreaChart>; // escape hatch for the raw Recharts chart
  children: ReactNode; // composed parts — <Area />, <XAxis />, <Legend />, …
  className?: string; // extra classes for the chart container
  config: TConfig & ValidateConfigKeys<TData, TConfig>; // series colors + labels
  curveType?: CurveType; // default curve interpolation for every <Area />
  data: TData[]; // rows rendered by the chart
  defaultSelectedDataKey?: string | null; // series selected on first render
  isLoading?: boolean; // shows the animated loading skeleton
  loadingPoints?: number; // number of points in the loading skeleton
  onBrushChange?: (range: EvilBrushRange) => void; // fires when the brush range changes
  onSelectionChange?: (selectedDataKey: string | null) => void; // fires when the selected series changes
  showBrush?: boolean; // renders a zoom brush below the chart
  stackType?: StackType; // how multiple areas combine
  xDataKey?: keyof TData & string; // x-axis key — only needed for the brush footer
}

type EvilAreaChartProps<
  TData extends Record<string, unknown>,
  TConfig extends Record<string, ChartConfig[string]>,
> = EvilAreaChartBaseProps<TData, TConfig>;

/**
 * Root of the composible area chart. Owns the data, the shared context, the
 * loading skeleton, and the optional zoom brush. Everything visual — axes,
 * grid, tooltip, legend, and the areas themselves — is composed as children,
 * so a consumer renders exactly the parts they need.
 */
export function EvilAreaChart<
  TData extends Record<string, unknown>,
  TConfig extends Record<string, ChartConfig[string]>,
>({
  config,
  data,
  children,
  className,
  chartProps,
  curveType = "linear",
  animationType = "left-to-right",
  stackType = "default",
  defaultSelectedDataKey = null,
  onSelectionChange,
  isLoading = false,
  loadingPoints,
  showBrush = false,
  xDataKey,
  brushHeight,
  brushFormatLabel,
  onBrushChange,
}: EvilAreaChartProps<TData, TConfig>) {
  const chartId = useId().replace(/:/g, ""); // colon-free id keeps CSS/SVG selectors valid
  const [selectedDataKey, setSelectedDataKey] = useState<string | null>(
    defaultSelectedDataKey
  );
  const { loadingData, onShimmerExit } = useLoadingData(
    isLoading,
    loadingPoints
  );
  const { visibleData, brushProps } = useEvilBrush({ data });

  const isExpanded = stackType === "expanded";
  const isStacked = stackType === "stacked" || isExpanded;
  const displayData = showBrush && !isLoading ? visibleData : data;

  // Updates selection state and notifies the parent
  const selectDataKey = useCallback(
    (newSelectedDataKey: string | null) => {
      setSelectedDataKey(newSelectedDataKey);
      onSelectionChange?.(newSelectedDataKey);
    },
    [onSelectionChange]
  );

  const contextValue = useMemo<AreaChartContextValue>(
    () => ({
      config,
      curveType,
      animationType,
      isStacked,
      isExpanded,
      isLoading,
      selectedDataKey,
      selectDataKey,
    }),
    [
      config,
      curveType,
      animationType,
      isStacked,
      isExpanded,
      isLoading,
      selectedDataKey,
      selectDataKey,
    ]
  );

  return (
    <AreaChartContext value={contextValue}>
      <ChartContainer
        className={className}
        config={config}
        footer={
          showBrush &&
          !isLoading && (
            <EvilBrush
              chartConfig={config}
              className="mt-1"
              curveType={curveType}
              data={data}
              formatLabel={brushFormatLabel}
              height={brushHeight}
              skipStyle
              stacked={isStacked}
              variant="area"
              xDataKey={xDataKey}
              {...brushProps}
              onChange={(range) => {
                brushProps.onChange(range);
                onBrushChange?.(range);
              }}
            />
          )
        }
      >
        <LoadingIndicator isLoading={isLoading} />
        <RechartsAreaChart
          accessibilityLayer
          data={isLoading ? loadingData : displayData}
          id={chartId}
          stackOffset={isExpanded ? "expand" : undefined}
          {...chartProps}
        >
          {children}
          {isLoading && (
            <LoadingArea
              chartId={chartId}
              curveType={curveType}
              onShimmerExit={onShimmerExit}
            />
          )}
        </RechartsAreaChart>
      </ChartContainer>
    </AreaChartContext>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Composible parts
// ─────────────────────────────────────────────────────────────────────────────

interface AreaProps {
  animationType?: AreaAnimationType; // intro reveal — falls back to the chart default
  areaProps?: Omit<ComponentProps<typeof RechartsArea>, "dataKey">; // escape hatch for raw Recharts Area props
  children?: ReactNode; // optional <Dot /> and <ActiveDot /> composition
  connectNulls?: boolean; // join segments across null/missing values
  curveType?: CurveType; // curve interpolation — falls back to the chart default
  dataKey: string; // series key — must exist on the data and config
  isClickable?: boolean; // lets this area be selected by clicking it
  strokeVariant?: StrokeVariant; // stroke style for this area
  variant?: AreaVariant; // fill style for this area only
}

/**
 * A single area series. Each <Area /> is fully self-contained: it generates its
 * own gradient/pattern definitions under a unique id, so any number of areas —
 * each with its own variant, stroke, and clickability — can live in one chart
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

  // The reveal is an animated SVG mask — heavier than a static chart — so
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

  const isAnimatedDashed = strokeVariant === "animated-dashed";
  const isDashed = strokeVariant === "dashed" || isAnimatedDashed;

  return (
    <>
      <RechartsArea
        activeDot={activeDot}
        connectNulls={connectNulls}
        dataKey={dataKey}
        dot={dot}
        fill={getFillPattern(variant, showUnselected, id)}
        fillOpacity={opacity.fill}
        // Recharts' built-in area animation is permanently disabled — it drew
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
      <defs>
        {revealType !== "none" && <RevealMask id={id} type={revealType} />}
        <ColorGradient
          config={config}
          dataKey={dataKey}
          id={id}
          isExpanded={isExpanded}
        />
        {variant === "gradient" && (
          <GradientPattern dataKey={dataKey} id={id} />
        )}
        {variant === "gradient-reverse" && (
          <ReverseGradientPattern dataKey={dataKey} id={id} />
        )}
        {variant === "solid" && <SolidPattern dataKey={dataKey} id={id} />}
        {variant === "dotted" && <DottedPattern dataKey={dataKey} id={id} />}
        {variant === "lines" && <LinesPattern dataKey={dataKey} id={id} />}
        {variant === "hatched" && <HatchedPattern dataKey={dataKey} id={id} />}
        {showUnselected && <UnselectedPattern dataKey={dataKey} id={id} />}
      </defs>
    </>
  );
}

interface DotProps {
  variant?: DotVariant; // visual style of the point marker
}

/**
 * Declares a resting point marker for the <Area /> it is composed inside.
 * It renders nothing on its own — the parent <Area /> reads its variant and
 * wires it into the Recharts dot slot.
 */
export const Dot: FC<DotProps> = () => null;

/**
 * Declares the hovered/active point marker for the <Area /> it is composed
 * inside. Like <Dot />, it is a configuration slot and renders nothing itself.
 */
export const ActiveDot: FC<DotProps> = () => null;

type XAxisProps = ComponentProps<typeof RechartsXAxis>;

/**
 * The horizontal category axis. Ships with the chart's flat default styling and
 * forwards every Recharts XAxis prop, so `dataKey`, `tickFormatter`, etc. are
 * passed straight through. Hidden automatically while the chart is loading.
 */
export function XAxis({
  tickLine = false,
  axisLine = false,
  tickMargin = 8,
  minTickGap = 8,
  ...props
}: XAxisProps) {
  const { isLoading } = useAreaChart();

  if (isLoading) {
    return null;
  }

  return (
    <RechartsXAxis
      axisLine={axisLine}
      minTickGap={minTickGap}
      tickLine={tickLine}
      tickMargin={tickMargin}
      {...props}
    />
  );
}

type YAxisProps = ComponentProps<typeof RechartsYAxis>;

/**
 * The vertical value axis. Forwards every Recharts YAxis prop and, when the
 * chart uses an expanded stack, formats ticks as percentages automatically.
 * Hidden automatically while the chart is loading.
 */
export function YAxis({
  tickLine = false,
  axisLine = false,
  tickMargin = 8,
  minTickGap = 8,
  width = "auto",
  tickFormatter,
  ...props
}: YAxisProps) {
  const { isLoading, isExpanded } = useAreaChart();

  if (isLoading) {
    return null;
  }

  return (
    <RechartsYAxis
      axisLine={axisLine}
      minTickGap={minTickGap}
      tickFormatter={isExpanded ? axisValueToPercentFormatter : tickFormatter}
      tickLine={tickLine}
      tickMargin={tickMargin}
      width={width}
      {...props}
    />
  );
}

type GridProps = ComponentProps<typeof CartesianGrid>;

/**
 * The background grid lines. Defaults to horizontal-only dashed lines and
 * forwards every Recharts CartesianGrid prop for full control.
 */
export function Grid({
  vertical = false,
  strokeDasharray = "3 3",
  ...props
}: GridProps) {
  return (
    <CartesianGrid
      strokeDasharray={strokeDasharray}
      vertical={vertical}
      {...props}
    />
  );
}

interface TooltipProps {
  cursor?: boolean; // whether the vertical cursor line follows the pointer
  defaultIndex?: number; // data index shown by default with no hover
  roundness?: TooltipRoundness; // border-radius of the tooltip
  variant?: TooltipVariant; // visual style of the tooltip surface
}

/**
 * The hover tooltip. Reads the chart's selection from context so its content
 * dims unselected series. Hidden automatically while the chart is loading.
 */
export function Tooltip({
  variant,
  roundness,
  defaultIndex,
  cursor = true,
}: TooltipProps) {
  const { isLoading, selectedDataKey } = useAreaChart();

  if (isLoading) {
    return null;
  }

  return (
    <ChartTooltip
      content={
        <ChartTooltipContent
          roundness={roundness}
          selected={selectedDataKey}
          variant={variant}
        />
      }
      cursor={
        cursor ? { strokeDasharray: "3 3", strokeWidth: STROKE_WIDTH } : false
      }
      defaultIndex={defaultIndex}
    />
  );
}

interface LegendProps {
  align?: "left" | "center" | "right"; // horizontal placement
  isClickable?: boolean; // lets each entry toggle selection of its series
  variant?: ChartLegendVariant; // visual style of the legend indicators
  verticalAlign?: "top" | "middle" | "bottom"; // vertical placement
}

/**
 * The series legend. When `isClickable` is set, each entry toggles selection of
 * its series, driving the shared selection state read by every <Area />.
 */
export function Legend({
  variant,
  align = "right",
  verticalAlign = "top",
  isClickable = false,
}: LegendProps) {
  const { selectedDataKey, selectDataKey } = useAreaChart();

  return (
    <ChartLegend
      align={align}
      content={
        <ChartLegendContent
          isClickable={isClickable}
          onSelectChange={selectDataKey}
          selected={selectedDataKey}
          variant={variant}
        />
      }
      verticalAlign={verticalAlign}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Selection + dot helpers
// ─────────────────────────────────────────────────────────────────────────────

// Returns fill/stroke/dot opacity — dims a series only when another is selected
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
    if (!isValidElement(child)) {
      return;
    }

    if (child.type === Dot) {
      const { variant } = (child as ReactElement<DotProps>).props;
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
      const { variant } = (child as ReactElement<DotProps>).props;
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

// ─────────────────────────────────────────────────────────────────────────────
// Style definitions — one set per <Area />, scoped to its unique id
// ─────────────────────────────────────────────────────────────────────────────

interface StyleProps {
  dataKey: string; // series key the colors belong to
  id: string; // unique id of the owning <Area />
}

// Animated dashed-stroke effect, rendered as a child of the Recharts Area
const AnimatedDashedStroke = () => (
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

// motion `originX` for each single-rect reveal — the edge the wipe grows from.
// 0 = left edge, 1 = right edge, 0.5 = centre (grows outward to both edges).
const SINGLE_REVEAL_ORIGIN: Record<
  Exclude<RevealAnimationType, "edges-in">,
  number
> = {
  "left-to-right": 0,
  "right-to-left": 1,
  "center-out": 0.5,
};

/**
 * Wipe mask driven by motion.dev, played once when an <Area /> mounts. The same
 * mask is applied to the area's fill, stroke, and resting dots, so all three
 * reveal in lockstep — fixing Recharts' default, where the dots appeared before
 * the line had finished drawing.
 *
 * `maskUnits`/`maskContentUnits` are both userSpaceOnUse so every masked element
 * shares one coordinate space and the wipe edge lands at the same x on each.
 *
 * Each rect animates `scaleX` 0 → 1; `originX` decides which edge it grows from.
 * "edges-in" needs two rects — each half grows inward from an opposite edge.
 */
const RevealMask = ({
  id,
  type,
}: {
  id: string;
  type: RevealAnimationType;
}) => {
  return (
    <mask
      height="100%"
      id={`${id}-reveal-mask`}
      maskContentUnits="userSpaceOnUse"
      maskUnits="userSpaceOnUse"
      width="100%"
      x="0"
      y="0"
    >
      {type === "edges-in" ? (
        <>
          {/* left half wipes inward from the left edge toward the centre */}
          <m.rect
            {...REVEAL_PROPS}
            fill="white"
            height="100%"
            style={{ originX: 0 }}
            width="50%"
            x="0"
            y="0"
          />
          {/* right half wipes inward from the right edge toward the centre */}
          <m.rect
            {...REVEAL_PROPS}
            fill="white"
            height="100%"
            style={{ originX: 1 }}
            width="50%"
            x="50%"
            y="0"
          />
        </>
      ) : (
        <m.rect
          {...REVEAL_PROPS}
          fill="white"
          height="100%"
          style={{ originX: SINGLE_REVEAL_ORIGIN[type] }}
          width="100%"
          x="0"
          y="0"
        />
      )}
    </mask>
  );
};

/**
 * Horizontal left-to-right color gradient for a series. Always rendered — every
 * fill variant, the stroke, and the dots all paint from this single gradient.
 */
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

/** Gradient fill that fades from visible at the top to transparent at the bottom. */
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

/** Gradient fill that fades from transparent at the top to visible at the bottom. */
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

/** Uniform low-opacity gradient fill with no vertical fade. */
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

/** Diagonal-line texture fill, masked from the series color gradient. */
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

/** Dotted texture fill, masked from the series color gradient. */
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

/** Hatched striped fill with a soft gradient across each stripe. */
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

/** Diagonal-line fill used to push a non-selected area into the background. */
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

// ─────────────────────────────────────────────────────────────────────────────
// Loading skeleton
// ─────────────────────────────────────────────────────────────────────────────

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

/**
 * Hook to manage loading data with pixel-perfect shimmer synchronization.
 *
 * Uses motion.dev's onUpdate callback to ensure chart data is only regenerated
 * when the shimmer has completely exited the visible area. This eliminates
 * timing drift issues from setTimeout/setInterval.
 */
export function useLoadingData(isLoading: boolean, loadingPoints = 14) {
  const [_loadingDataKey, setLoadingDataKey] = useState(false);

  // Callback fired by motion.dev when the shimmer exits the visible area
  const onShimmerExit = useCallback(() => {
    if (isLoading) {
      setLoadingDataKey((prev) => !prev);
    }
  }, [isLoading]);

  const loadingData = useMemo(
    () => getLoadingData(loadingPoints),
    // loadingDataKey toggle triggers re-computation when the shimmer exits
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loadingPoints]
  );

  return { loadingData, onShimmerExit };
}

/**
 * The skeleton area shown while the chart is loading. Rendered by the root in
 * place of the real areas, paired with its own masked shimmer pattern.
 */
const LoadingArea = ({
  chartId,
  curveType,
  onShimmerExit,
}: {
  chartId: string;
  curveType: CurveType;
  onShimmerExit: () => void;
}) => (
  <>
    <RechartsArea
      activeDot={false}
      dataKey={LOADING_AREA_DATA_KEY}
      dot={false}
      fill="currentColor"
      fillOpacity={0.05}
      isAnimationActive={false}
      legendType="none"
      stroke="currentColor"
      strokeOpacity={0.5}
      style={{ mask: `url(#${chartId}-loading-mask)` }}
      tooltipType="none"
      type={curveType}
    />
    <defs>
      <LoadingPattern chartId={chartId} onShimmerExit={onShimmerExit} />
    </defs>
  </>
);

/**
 * Animated shimmer pattern for the loading skeleton.
 *
 * The visible chart area is normalized to 0-1, the shimmer gradient has width 1,
 * and the pattern is 3x wide so the shimmer has buffer on both sides. The motion
 * rect travels x from -1 to 2; onShimmerExit fires as it crosses x=1, letting the
 * data swap happen while the shimmer is off-screen for a seamless loop.
 */
const LoadingPattern = ({
  chartId,
  onShimmerExit,
}: {
  chartId: string;
  onShimmerExit: () => void;
}) => {
  const gradientStops = generateEasedGradientStops();

  // 1 (left buffer) + 1 (visible) + 1 (right buffer)
  const patternWidth = 3;
  const startX = -1;
  const endX = 2;

  // Tracks the last x value to detect the exit threshold crossing
  const lastXRef = useRef(startX);

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
          onUpdate={(latest) => {
            const xValue = typeof latest.x === "number" ? latest.x : startX;
            const lastX = lastXRef.current;

            // Fire once per loop, when the shimmer fully exits the visible area
            if (xValue >= 1 && lastX < 1) {
              onShimmerExit();
            }

            lastXRef.current = xValue;
          }}
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
