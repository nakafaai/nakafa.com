"use client";

import { ChartContainer } from "@repo/design-system/components/evilcharts/ui/chart";
import {
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
  Curve,
  type CurveProps,
  Line as RechartsLine,
  LineChart as RechartsLineChart,
  XAxis as RechartsXAxis,
  YAxis as RechartsYAxis,
} from "recharts";

// Constants
const STROKE_WIDTH = 1;
const LOADING_LINE_DATA_KEY = "loading";
const LOADING_ANIMATION_DURATION = 2000; // in milliseconds
const REVEAL_DURATION = 1; // intro wipe length, in seconds
const REVEAL_EASE: [number, number, number, number] = [0, 0.7, 0.5, 1]; // intro wipe easing
const REVEAL_PROPS = {
  initial: { scaleX: 0 },
  animate: { scaleX: 1 },
  transition: { duration: REVEAL_DURATION, ease: REVEAL_EASE },
};

type CurveType = ComponentProps<typeof RechartsLine>["type"];
type LineDotProp = ComponentProps<typeof RechartsLine>["dot"];
type LineActiveDotProp = ComponentProps<typeof RechartsLine>["activeDot"];
type StrokeVariant = "solid" | "dashed" | "animated-dashed";

/**
 * Direction of the custom motion.dev intro reveal. Recharts' own line animation
 * is permanently disabled (it drew the line after the dots had already popped
 * in) — these reveals replace it.
 *
 * NOTE: a reveal is a per-frame animated SVG mask, so it is heavier than a
 * static chart. `"none"` opts out entirely; it is also what a device with the
 * OS "reduce motion" preference falls back to automatically.
 */
type LineAnimationType =
  | "none"
  | "left-to-right"
  | "right-to-left"
  | "center-out"
  | "edges-in";
type RevealAnimationType = Exclude<LineAnimationType, "none">;

// ─────────────────────────────────────────────────────────────────────────────
// Shared context
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shared state for every part of the chart. Lifted into <EvilLineChart /> so that
 * <Line />, <XAxis />, <Legend />, and friends can read it without prop drilling.
 * Sub-components are composed freely — the provider is the single source of truth.
 */
interface LineChartContextValue {
  animationType: LineAnimationType; // default intro reveal each <Line /> inherits
  config: ChartConfig; // colors + labels for every series
  curveType: CurveType; // default curve interpolation each <Line /> inherits
  isLoading: boolean; // whether the chart shows its loading skeleton
  selectDataKey: (dataKey: string | null) => void; // sets the selected series
  selectedDataKey: string | null; // currently selected series, or null when none
}

const LineChartContext = createContext<LineChartContextValue | null>(null);

// Reads the chart context, throwing a helpful error when used outside <EvilLineChart />
function useLineChart() {
  const context = use(LineChartContext);

  if (!context) {
    throw new Error(
      "Line chart parts (<Line />, <XAxis />, …) must be used within <EvilLineChart />"
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

interface EvilLineChartBaseProps<
  TData extends Record<string, unknown>,
  TConfig extends Record<string, ChartConfig[string]>,
> {
  animationType?: LineAnimationType; // default intro reveal for every <Line />
  brushFormatLabel?: (value: unknown, index: number) => string; // formats brush axis labels
  brushHeight?: number; // height of the brush preview in pixels
  chartProps?: ComponentProps<typeof RechartsLineChart>; // escape hatch for the raw Recharts chart
  children: ReactNode; // composed parts — <Line />, <XAxis />, <Legend />, …
  className?: string; // extra classes for the chart container
  config: TConfig & ValidateConfigKeys<TData, TConfig>; // series colors + labels
  curveType?: CurveType; // default curve interpolation for every <Line />
  data: TData[]; // rows rendered by the chart
  defaultSelectedDataKey?: string | null; // series selected on first render
  isLoading?: boolean; // shows the animated loading skeleton
  loadingPoints?: number; // number of points in the loading skeleton
  onBrushChange?: (range: EvilBrushRange) => void; // fires when the brush range changes
  onSelectionChange?: (selectedDataKey: string | null) => void; // fires when the selected series changes
  showBrush?: boolean; // renders a zoom brush below the chart
  xDataKey?: keyof TData & string; // x-axis key — only needed for the brush footer
}

type EvilLineChartProps<
  TData extends Record<string, unknown>,
  TConfig extends Record<string, ChartConfig[string]>,
> = EvilLineChartBaseProps<TData, TConfig>;

/**
 * Root of the composible line chart. Owns the data, the shared context, the
 * loading skeleton, and the optional zoom brush. Everything visual — axes,
 * grid, tooltip, legend, and the lines themselves — is composed as children,
 * so a consumer renders exactly the parts they need.
 */
export function EvilLineChart<
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
  defaultSelectedDataKey = null,
  onSelectionChange,
  isLoading = false,
  loadingPoints,
  showBrush = false,
  xDataKey,
  brushHeight,
  brushFormatLabel,
  onBrushChange,
}: EvilLineChartProps<TData, TConfig>) {
  const chartId = useId().replace(/:/g, ""); // colon-free id keeps CSS/SVG selectors valid
  const [selectedDataKey, setSelectedDataKey] = useState<string | null>(
    defaultSelectedDataKey
  );
  const { loadingData, onShimmerExit } = useLoadingData(
    isLoading,
    loadingPoints
  );
  const { visibleData, brushProps } = useEvilBrush({ data });

  const displayData = showBrush && !isLoading ? visibleData : data;

  // Updates selection state and notifies the parent
  const selectDataKey = useCallback(
    (newSelectedDataKey: string | null) => {
      setSelectedDataKey(newSelectedDataKey);
      onSelectionChange?.(newSelectedDataKey);
    },
    [onSelectionChange]
  );

  const contextValue = useMemo<LineChartContextValue>(
    () => ({
      config,
      curveType,
      animationType,
      isLoading,
      selectedDataKey,
      selectDataKey,
    }),
    [
      config,
      curveType,
      animationType,
      isLoading,
      selectedDataKey,
      selectDataKey,
    ]
  );

  return (
    <LineChartContext value={contextValue}>
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
              variant="line"
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
        <RechartsLineChart
          accessibilityLayer
          data={isLoading ? loadingData : displayData}
          id={chartId}
          {...chartProps}
        >
          {children}
          {isLoading && (
            <LoadingLine
              chartId={chartId}
              curveType={curveType}
              onShimmerExit={onShimmerExit}
            />
          )}
        </RechartsLineChart>
      </ChartContainer>
    </LineChartContext>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Composible parts
// ─────────────────────────────────────────────────────────────────────────────

interface LineProps {
  animationType?: LineAnimationType; // intro reveal — falls back to the chart default
  children?: ReactNode; // optional <Dot /> and <ActiveDot /> composition
  connectNulls?: boolean; // join segments across null/missing values
  curveType?: CurveType; // curve interpolation — falls back to the chart default
  dataKey: string; // series key — must exist on the data and config
  enableBufferLine?: boolean; // renders this line's last segment as a dashed buffer
  glowing?: boolean; // applies a soft outer glow to this line
  isClickable?: boolean; // lets this line be selected by clicking it
  lineProps?: ComponentProps<typeof RechartsLine>; // escape hatch for raw Recharts Line props
  strokeVariant?: StrokeVariant; // stroke style for this line only
}

/**
 * A single line series. Each <Line /> is fully self-contained: it generates its
 * own gradient and glow definitions under a unique id, so any number of lines —
 * each with its own stroke, glow, and clickability — can live in one chart
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

  // The reveal is an animated SVG mask — heavier than a static chart — so
  // `"none"` and the OS reduce-motion preference both opt out of it.
  const revealType: LineAnimationType = shouldReduceMotion
    ? "none"
    : (animationType ?? defaultAnimation);
  const maskId = revealType === "none" ? undefined : `${id}-reveal-mask`;

  const isSelected = selectedDataKey === dataKey;
  const hasSelection = selectedDataKey !== null;
  const opacity = getOpacity(selectedDataKey, dataKey);
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
          activeDot={activeDot}
          connectNulls={connectNulls}
          dataKey={dataKey}
          dot={dot}
          filter={
            glowing
              ? `url(#${getChartSeriesId(id, "glow", dataKey)})`
              : undefined
          }
          // Recharts' built-in line animation is permanently disabled — it drew
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
 * It renders nothing on its own — the parent <Line /> reads its variant and
 * wires it into the Recharts dot slot.
 */
export const Dot: FC<DotProps> = () => null;

/**
 * Declares the hovered/active point marker for the <Line /> it is composed
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
  const { isLoading } = useLineChart();

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
 * The vertical value axis. Ships with the chart's flat default styling and
 * forwards every Recharts YAxis prop. Hidden automatically while the chart is
 * loading.
 */
export function YAxis({
  tickLine = false,
  axisLine = false,
  tickMargin = 8,
  minTickGap = 8,
  width = "auto",
  ...props
}: YAxisProps) {
  const { isLoading } = useLineChart();

  if (isLoading) {
    return null;
  }

  return (
    <RechartsYAxis
      axisLine={axisLine}
      minTickGap={minTickGap}
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
  const { isLoading, selectedDataKey } = useLineChart();

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
 * its series, driving the shared selection state read by every <Line />.
 */
export function Legend({
  variant,
  align = "right",
  verticalAlign = "top",
  isClickable = false,
}: LegendProps) {
  const { selectedDataKey, selectDataKey } = useLineChart();

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

// Returns stroke/dot opacity — dims a series only when another is selected
const getOpacity = (selectedDataKey: string | null, dataKey: string) => {
  if (selectedDataKey === null) {
    return { stroke: 1, dot: 1 };
  }

  return selectedDataKey === dataKey
    ? { stroke: 1, dot: 1 }
    : { stroke: 0.3, dot: 0.3 };
};

// Resolves a line's stroke-dasharray — the buffer line manages its own dashes
const getStrokeDasharray = (enableBufferLine: boolean, isDashed: boolean) => {
  if (enableBufferLine) {
    return;
  }

  return isDashed ? "5 5" : undefined;
};

// Pulls <Dot /> and <ActiveDot /> out of a line's children into Recharts dot slots.
// When a `maskId` is given the resting dot is wired to the intro reveal mask so it
// wipes in with the line; the active dot is always left unmasked since it only
// appears on hover, after the intro has finished.
const resolveDots = (
  children: ReactNode,
  id: string,
  dataKey: string,
  dotOpacity: number,
  maskId: string | undefined
): { dot: LineDotProp; activeDot: LineActiveDotProp } => {
  let dot: LineDotProp = false;
  let activeDot: LineActiveDotProp = false;

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
// Buffer line
// ─────────────────────────────────────────────────────────────────────────────

// Buffer line shape — renders the last segment as dashed while the rest stays solid.
// Renders a single <Curve> and uses a ref callback to measure the actual SVG path
// length via getTotalLength() + getPointAtLength(), then sets stroke-dasharray
// imperatively. Works correctly with any curve type (linear, natural, monotone, etc.).
type CurvePoint = NonNullable<NonNullable<CurveProps["points"]>[number]>;
type DrawableCurvePoint = CurvePoint & { x: number; y: number };

const isDrawableCurvePoint = (point: CurvePoint): point is DrawableCurvePoint =>
  typeof point.x === "number" && typeof point.y === "number";

const BUFFER_DASH_SIZE = 4;
const BUFFER_GAP_SIZE = 3;

// Binary-search the path to find the length at which path.x ≈ targetX,
// using the browser's native getPointAtLength for exact curve measurement.
const findLengthAtX = (
  path: SVGPathElement,
  totalLength: number,
  targetX: number
): number => {
  let lo = 0;
  let hi = totalLength;
  // ~0.5px precision is more than enough for a dasharray split
  while (hi - lo > 0.5) {
    const mid = (lo + hi) / 2;
    const pt = path.getPointAtLength(mid);
    if (pt.x < targetX) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
};

const bufferLineShape = (props: CurveProps) => {
  const { points, ...rest } = props;

  if (!points || points.length < 2) {
    return <Curve {...props} />;
  }

  const drawablePoints = points.filter(isDrawableCurvePoint);

  if (drawablePoints.length < 2) {
    return <Curve {...props} />;
  }

  // x coordinate of the second-to-last point — where solid meets dashed
  const splitPoint = drawablePoints.at(-2);
  if (!splitPoint) {
    return <Curve {...props} />;
  }
  const splitX = splitPoint.x;

  // Ref callback runs synchronously during React commit (before browser paint),
  // so there's no visible flash of an un-dashed line.
  const gRef = (g: SVGGElement | null) => {
    if (!g) {
      return;
    }
    const path = g.querySelector("path");
    if (!path) {
      return;
    }

    const totalLength = path.getTotalLength();
    const solidLength = findLengthAtX(path, totalLength, splitX);
    const lastSegmentLength = totalLength - solidLength;

    // Build dasharray: solid run, then repeating dash-gap for the buffer segment
    const reps =
      Math.ceil(lastSegmentLength / (BUFFER_DASH_SIZE + BUFFER_GAP_SIZE)) + 1;
    const dashedPart = Array.from(
      { length: reps },
      () => `${BUFFER_DASH_SIZE} ${BUFFER_GAP_SIZE}`
    ).join(" ");

    path.setAttribute("stroke-dasharray", `${solidLength} 0 ${dashedPart}`);
  };

  return (
    <g ref={gRef}>
      <Curve {...rest} points={drawablePoints} />
    </g>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Style definitions — one set per <Line />, scoped to its unique id
// ─────────────────────────────────────────────────────────────────────────────

interface StyleProps {
  dataKey: string; // series key the style belongs to
  id: string; // unique id of the owning <Line />
}

// Animated dashed-stroke effect, rendered as a child of the Recharts Line
const AnimatedDashedStroke = () => (
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
 * Wipe mask driven by motion.dev, played once when a <Line /> mounts. The same
 * mask is applied to the line's stroke and its resting dots, so both reveal in
 * lockstep — fixing Recharts' default, where the dots appeared before the line
 * had finished drawing.
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
 * Horizontal left-to-right color gradient for multi-stop line and dot paints.
 * Single-color line strokes use the scoped CSS variable directly so perfectly
 * horizontal or vertical paths do not depend on an object-bounding-box gradient.
 */
const ColorGradient = ({
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
const GlowFilter = ({ id, dataKey }: StyleProps) => (
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
 * The skeleton line shown while the chart is loading. Rendered by the root in
 * place of the real lines, paired with its own masked shimmer pattern.
 */
const LoadingLine = ({
  chartId,
  curveType,
  onShimmerExit,
}: {
  chartId: string;
  curveType: CurveType;
  onShimmerExit: () => void;
}) => (
  <>
    <RechartsLine
      activeDot={false}
      dataKey={LOADING_LINE_DATA_KEY}
      dot={false}
      isAnimationActive={false}
      legendType="none"
      max={100}
      min={0}
      stroke="currentColor"
      strokeOpacity={0.5}
      strokeWidth={STROKE_WIDTH}
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
