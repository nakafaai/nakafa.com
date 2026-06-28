"use client";

import { useReducedMotion } from "@mantine/hooks";
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
  BAR_REVEAL_DURATION_MS,
  BAR_REVEAL_STAGGER_MS,
  getOrderedRevealStep,
  type OrderedRevealAnimation,
  useOrderedReveal,
} from "@repo/design-system/components/evilcharts/ui/reveal-animation";
import {
  ChartTooltip,
  ChartTooltipContent,
  type TooltipRoundness,
  type TooltipVariant,
} from "@repo/design-system/components/evilcharts/ui/tooltip";
import { m } from "motion/react";
import {
  Children,
  type ComponentProps,
  createContext,
  type FC,
  isValidElement,
  type KeyboardEvent,
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
  Bar as RechartsBar,
  ComposedChart as RechartsComposedChart,
  Line as RechartsLine,
  ReferenceLine as RechartsReferenceLine,
  Scatter as RechartsScatter,
  XAxis as RechartsXAxis,
  YAxis as RechartsYAxis,
} from "recharts";

// Constants
const STROKE_WIDTH = 2;
const DEFAULT_BAR_RADIUS = 4;
const LOADING_DATA_KEY = "loading";
const LOADING_ANIMATION_DURATION = 2000; // in milliseconds
const REVEAL_DURATION = 1; // line intro wipe length, in seconds
const REVEAL_EASE: [number, number, number, number] = [0, 0.7, 0.5, 1]; // intro easing
const REVEAL_PROPS = {
  animate: { scaleX: [0, 1] },
  transition: { duration: REVEAL_DURATION, ease: REVEAL_EASE },
};

type CurveType = ComponentProps<typeof RechartsLine>["type"];
type LineDotProp = ComponentProps<typeof RechartsLine>["dot"];
type LineActiveDotProp = ComponentProps<typeof RechartsLine>["activeDot"];
type ScatterShapeProp = ComponentProps<typeof RechartsScatter>["shape"];
type ScatterActiveShapeProp = ComponentProps<
  typeof RechartsScatter
>["activeShape"];
type StrokeVariant = "solid" | "dashed" | "animated-dashed";
type BarVariant =
  | "default"
  | "hatched"
  | "duotone"
  | "duotone-reverse"
  | "gradient"
  | "stripped";

/**
 * Direction of the custom motion.dev intro. Recharts' own animation is
 * permanently disabled — lines wipe in along this direction, while bars grow up
 * from their baseline staggered in this same order.
 *
 * NOTE: the intro is a per-frame animation, heavier than a static chart.
 * `"none"` opts out — as does a device with the OS "reduce motion" preference.
 */
type ComposedAnimationType = "none" | OrderedRevealAnimation;
type RevealAnimationType = OrderedRevealAnimation;

// ─────────────────────────────────────────────────────────────────────────────
// Shared context
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shared state for every part of the chart. Lifted into <EvilComposedChart /> so
 * that <Bar />, <Line />, <XAxis />, <Legend />, and friends can read it without
 * prop drilling. Sub-components are composed freely — the provider is the single
 * source of truth.
 */
interface ComposedChartContextValue {
  animationType: ComposedAnimationType; // default intro each <Bar />/<Line /> inherits
  config: ChartConfig; // colors + labels for every bar and line series
  curveType: CurveType; // default curve interpolation each <Line /> inherits
  dataLength: number; // number of rows currently rendered
  hoveredIndex: number | null; // data index currently hovered, or null when none
  isLoading: boolean; // whether the chart shows its loading skeleton
  selectDataKey: (dataKey: string | null) => void; // sets the selected series
  selectedDataKey: string | null; // currently selected series, or null when none
}

const ComposedChartContext = createContext<ComposedChartContextValue | null>(
  null
);

// Reads the chart context, throwing a helpful error when used outside <EvilComposedChart />
function useComposedChart() {
  const context = use(ComposedChartContext);

  if (!context) {
    throw new Error(
      "Composed chart parts (<Bar />, <Line />, <XAxis />, …) must be used within <EvilComposedChart />"
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

interface EvilComposedChartBaseProps<
  TData extends Record<string, unknown>,
  TConfig extends Record<string, ChartConfig[string]>,
> {
  animationType?: ComposedAnimationType; // default intro for every <Bar /> and <Line />
  barCategoryGap?: number; // gap between bar categories
  barGap?: number; // gap between bars sharing a category
  brushFormatLabel?: (value: unknown, index: number) => string; // formats brush axis labels
  brushHeight?: number; // height of the brush preview in pixels
  chartProps?: ComponentProps<typeof RechartsComposedChart>; // escape hatch for the raw Recharts chart
  children: ReactNode; // composed parts — <Bar />, <Line />, <XAxis />, <Legend />, …
  className?: string; // extra classes for the chart container
  config: TConfig & ValidateConfigKeys<TData, TConfig>; // series colors + labels for bars and lines
  curveType?: CurveType; // default curve interpolation for every <Line />
  data: TData[]; // rows rendered by the chart
  defaultSelectedDataKey?: string | null; // series selected on first render
  isLoading?: boolean; // shows the animated loading skeleton
  loadingBars?: number; // number of bars in the loading skeleton
  onBrushChange?: (range: EvilBrushRange) => void; // fires when the brush range changes
  onSelectionChange?: (selectedDataKey: string | null) => void; // fires when the selected series changes
  showBrush?: boolean; // renders a zoom brush below the chart
  xDataKey?: keyof TData & string; // x-axis key — only needed for the brush footer
}

type EvilComposedChartProps<
  TData extends Record<string, unknown>,
  TConfig extends Record<string, ChartConfig[string]>,
> = EvilComposedChartBaseProps<TData, TConfig>;

/**
 * Root of the composible composed chart. Owns the data, the shared context, the
 * loading skeleton, and the optional zoom brush. Everything visual — axes, grid,
 * tooltip, legend, and the bars and lines themselves — is composed as children,
 * so a consumer renders exactly the parts they need.
 */
export function EvilComposedChart<
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
  barGap,
  barCategoryGap,
  defaultSelectedDataKey = null,
  onSelectionChange,
  isLoading = false,
  loadingBars,
  showBrush = false,
  xDataKey,
  brushHeight,
  brushFormatLabel,
  onBrushChange,
}: EvilComposedChartProps<TData, TConfig>) {
  const chartId = useId().replace(/:/g, ""); // colon-free id keeps CSS/SVG selectors valid
  const [selectedDataKey, setSelectedDataKey] = useState<string | null>(
    defaultSelectedDataKey
  );
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const { loadingData, onShimmerExit } = useLoadingData(isLoading, loadingBars);
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

  const contextValue = useMemo<ComposedChartContextValue>(
    () => ({
      config,
      curveType,
      animationType,
      dataLength: displayData.length,
      isLoading,
      hoveredIndex,
      selectedDataKey,
      selectDataKey,
    }),
    [
      config,
      curveType,
      animationType,
      displayData.length,
      isLoading,
      hoveredIndex,
      selectedDataKey,
      selectDataKey,
    ]
  );

  return (
    <ComposedChartContext value={contextValue}>
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
        <RechartsComposedChart
          accessibilityLayer
          barCategoryGap={barCategoryGap}
          barGap={barGap}
          data={isLoading ? loadingData : displayData}
          id={chartId}
          onMouseLeave={() => setHoveredIndex(null)}
          {...chartProps}
        >
          {children}
          {isLoading && (
            <LoadingBar
              barRadius={DEFAULT_BAR_RADIUS}
              chartId={chartId}
              onShimmerExit={onShimmerExit}
            />
          )}
        </RechartsComposedChart>
      </ChartContainer>
    </ComposedChartContext>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Composible parts
// ─────────────────────────────────────────────────────────────────────────────

interface BarProps {
  animationType?: ComposedAnimationType; // grow-in order — falls back to the chart default
  barProps?: ComponentProps<typeof RechartsBar>; // escape hatch for raw Recharts Bar props
  dataKey: string; // series key — must exist on the data and config
  enableHoverHighlight?: boolean; // dims this bar when another column is hovered
  glow?: boolean; // applies a soft neon glow to this bar
  isClickable?: boolean; // lets this bar be selected by clicking it
  radius?: number; // corner radius of the bar in pixels
  variant?: BarVariant; // fill style for this bar only
}

/**
 * A single bar series. Each <Bar /> is fully self-contained: it generates its
 * own gradient/pattern definitions under a unique id, so any number of bars —
 * each with its own variant, glow, and clickability — can live in one chart
 * without style collisions.
 */
export function Bar({
  dataKey,
  variant = "default",
  radius = DEFAULT_BAR_RADIUS,
  glow = false,
  animationType,
  isClickable = false,
  enableHoverHighlight = false,
  barProps,
}: BarProps) {
  const {
    config,
    animationType: defaultAnimation,
    dataLength,
    isLoading,
    hoveredIndex,
    selectedDataKey,
    selectDataKey,
  } = useComposedChart();
  const id = useId().replace(/:/g, ""); // unique id scopes this bar's style defs
  // Devices set to "reduce motion" skip the grow-in animation entirely
  const shouldReduceMotion = useReducedMotion();

  const isSelected = selectedDataKey === null || selectedDataKey === dataKey;
  const filter = glow ? `url(#${id}-glow)` : undefined;
  const colorSlots = getColorsCount(config[dataKey] ?? {});

  // The grow-in is a per-frame animation — heavier than a static chart — so
  // `"none"` and the OS reduce-motion preference both opt out of it.
  const revealType: ComposedAnimationType = shouldReduceMotion
    ? "none"
    : (animationType ?? defaultAnimation);
  const isRevealActive = useOrderedReveal(
    isLoading ? "none" : revealType,
    dataLength
  );

  // The root renders the skeleton bar while loading, so real bars step aside
  if (isLoading) {
    return null;
  }

  return (
    <>
      <RechartsBar
        dataKey={dataKey}
        fill={`url(#${id}-bar-colors)`}
        // Recharts' built-in bar animation is permanently disabled — every bar
        // instead grows in from its baseline via the staggered motion.dev shape.
        isAnimationActive={false}
        radius={radius}
        shape={(props: unknown) => {
          const barShapeProps = props as BarShapeProps;
          const index =
            typeof barShapeProps.index === "number" ? barShapeProps.index : -1;

          return (
            <CustomBar
              {...barShapeProps}
              animationType={revealType}
              barRadius={radius}
              colorSlots={colorSlots}
              dataKey={dataKey}
              dataLength={dataLength}
              enableHoverHighlight={enableHoverHighlight}
              fillOpacity={getBarOpacity({
                isClickable,
                isSelected,
                selectedDataKey,
                enableHoverHighlight,
                hoveredIndex,
                index,
              })}
              filter={filter}
              id={id}
              isClickable={isClickable}
              isRevealActive={isRevealActive}
              onClick={
                isClickable
                  ? () => {
                      selectDataKey(
                        selectedDataKey === dataKey ? null : dataKey
                      );
                    }
                  : undefined
              }
              variant={variant}
            />
          );
        }}
        style={
          isClickable || enableHoverHighlight
            ? { cursor: "pointer" }
            : undefined
        }
        {...barProps}
      />
      <defs>
        <VerticalColorGradient config={config} dataKey={dataKey} id={id} />
        {variant === "hatched" && <HatchedPattern dataKey={dataKey} id={id} />}
        {variant === "duotone" && (
          <DuotonePattern config={config} dataKey={dataKey} id={id} />
        )}
        {variant === "duotone-reverse" && (
          <DuotoneReversePattern config={config} dataKey={dataKey} id={id} />
        )}
        {variant === "gradient" && (
          <GradientPattern dataKey={dataKey} id={id} />
        )}
        {variant === "stripped" && (
          <StrippedPattern dataKey={dataKey} id={id} />
        )}
        {glow && <BarGlowFilter id={id} />}
      </defs>
    </>
  );
}

interface LineProps {
  animationType?: ComposedAnimationType; // intro reveal — falls back to the chart default
  children?: ReactNode; // optional <Dot /> and <ActiveDot /> composition
  connectNulls?: boolean; // join segments across null/missing values
  curveType?: CurveType; // curve interpolation — falls back to the chart default
  dataKey: string; // series key — must exist on the data and config
  glow?: boolean; // applies a soft neon glow to this line
  isClickable?: boolean; // lets this line be selected by clicking it
  lineProps?: ComponentProps<typeof RechartsLine>; // escape hatch for raw Recharts Line props
  strokeVariant?: StrokeVariant; // stroke style for this line only
}

/**
 * A single line series. Each <Line /> is fully self-contained: it generates its
 * own color gradient and glow filter under a unique id, so any number of lines —
 * each with its own stroke, curve, glow, and clickability — can live in one chart
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

  // The reveal is an animated SVG mask — heavier than a static chart — so
  // `"none"` and the OS reduce-motion preference both opt out of it.
  const revealType: ComposedAnimationType = shouldReduceMotion
    ? "none"
    : (animationType ?? defaultAnimation);
  const maskId = revealType === "none" ? undefined : `${id}-reveal-mask`;

  const opacity = getOpacity(selectedDataKey, dataKey);
  const hasSelection = selectedDataKey !== null;
  const filter = glow ? `url(#${id}-glow)` : undefined;
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
        activeDot={activeDot}
        connectNulls={connectNulls}
        dataKey={dataKey}
        dot={dot}
        filter={filter}
        // Recharts' built-in line animation is permanently disabled — the
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

interface ScatterProps
  extends Omit<
    ComponentProps<typeof RechartsScatter>,
    "activeShape" | "dataKey" | "fill" | "name" | "shape"
  > {
  children?: ReactNode; // optional <Dot /> and <ActiveDot /> composition
  dataKey: string; // chart config key used for color, legend, and tooltip labels
}

/**
 * A scatter series for free x/y points. EvilCharts does not document a scatter
 * primitive, so this part keeps the EvilCharts root/config contract while using
 * Recharts' native Scatter geometry instead of faking points with a line.
 */
export function Scatter({ dataKey, children, ...scatterProps }: ScatterProps) {
  const { config, isLoading, selectedDataKey } = useComposedChart();
  const id = useId().replace(/:/g, "");

  if (isLoading) {
    return null;
  }

  const opacity = getOpacity(selectedDataKey, dataKey);
  const chartId = `${id}-scatter`;
  const { shape, activeShape } = resolveScatterShapes(
    children,
    chartId,
    dataKey,
    opacity.dot
  );

  return (
    <>
      <RechartsScatter
        activeShape={activeShape}
        fill={`url(#${getChartSeriesId(chartId, "colors", dataKey)})`}
        isAnimationActive={false}
        legendType="circle"
        name={dataKey}
        shape={shape}
        {...scatterProps}
      />
      <defs>
        <ScatterColorGradient config={config} dataKey={dataKey} id={chartId} />
      </defs>
    </>
  );
}

type ReferenceLineProps = ComponentProps<typeof RechartsReferenceLine>;

/**
 * A reference segment/line inside an EvilCharts composed chart. Used for
 * pedagogical helpers such as residual distances on scatter diagrams.
 */
export function ReferenceLine(props: ReferenceLineProps) {
  const { isLoading } = useComposedChart();

  if (isLoading) {
    return null;
  }

  return <RechartsReferenceLine {...props} />;
}

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
  const { isLoading } = useComposedChart();

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
 * The vertical value axis. Forwards every Recharts YAxis prop straight through.
 * Hidden automatically while the chart is loading.
 */
export function YAxis({
  tickLine = false,
  axisLine = false,
  tickMargin = 8,
  minTickGap = 8,
  width = "auto",
  ...props
}: YAxisProps) {
  const { isLoading } = useComposedChart();

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
  cursor?: ComponentProps<typeof ChartTooltip>["cursor"]; // hover guide/cursor renderer
  defaultIndex?: number; // data index shown by default with no hover
  hideContent?: boolean; // keeps the hover cursor while visually hiding tooltip content
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
  hideContent = false,
  cursor = { strokeDasharray: "3 3", strokeWidth: STROKE_WIDTH },
}: TooltipProps) {
  const { isLoading, selectedDataKey } = useComposedChart();

  if (isLoading) {
    return null;
  }

  return (
    <ChartTooltip
      content={
        <ChartTooltipContent
          hideLabel={hideContent}
          roundness={roundness}
          selected={selectedDataKey}
          variant={variant}
        />
      }
      cursor={cursor}
      defaultIndex={defaultIndex}
      wrapperStyle={hideContent ? { visibility: "hidden" } : undefined}
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
 * its series, driving the shared selection state read by every <Bar /> and <Line />.
 */
export function Legend({
  variant,
  align = "right",
  verticalAlign = "top",
  isClickable = false,
}: LegendProps) {
  const { selectedDataKey, selectDataKey } = useComposedChart();

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

// Returns stroke/dot opacity for a line — dims a series only when another is selected
const getOpacity = (selectedDataKey: string | null, dataKey: string) => {
  if (selectedDataKey === null) {
    return { stroke: 1, dot: 1 };
  }

  return selectedDataKey === dataKey
    ? { stroke: 1, dot: 1 }
    : { stroke: 0.3, dot: 0.3 };
};

// Returns the fill opacity for a bar, accounting for both selection and hover state
const getBarOpacity = ({
  isClickable,
  isSelected,
  selectedDataKey,
  enableHoverHighlight,
  hoveredIndex,
  index,
}: {
  isClickable: boolean;
  isSelected: boolean;
  selectedDataKey: string | null;
  enableHoverHighlight: boolean;
  hoveredIndex: number | null;
  index: number;
}) => {
  let clickOpacity = 1;
  if (isClickable && selectedDataKey !== null) {
    clickOpacity = isSelected ? 1 : 0.3;
  }

  if (enableHoverHighlight && hoveredIndex !== null) {
    return hoveredIndex === index ? clickOpacity : clickOpacity * 0.3;
  }

  return clickOpacity;
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
          chartId={`${id}-line`}
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
          chartId={`${id}-line`}
          dataKey={dataKey}
          fillOpacity={dotOpacity}
          type={variant}
        />
      );
    }
  });

  return { dot, activeDot };
};

// Pulls <Dot /> and <ActiveDot /> into Recharts Scatter shape slots.
const resolveScatterShapes = (
  children: ReactNode,
  id: string,
  dataKey: string,
  dotOpacity: number
): { shape: ScatterShapeProp; activeShape: ScatterActiveShapeProp } => {
  let shape: ScatterShapeProp = (
    <ChartDot
      chartId={id}
      dataKey={dataKey}
      fillOpacity={dotOpacity}
      type="default"
    />
  );
  let activeShape: ScatterActiveShapeProp = (
    <ChartDot
      chartId={id}
      dataKey={dataKey}
      fillOpacity={dotOpacity}
      type="colored-border"
    />
  );

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) {
      return;
    }

    if (child.type === Dot) {
      const { variant } = (child as ReactElement<DotProps>).props;
      shape = (
        <ChartDot
          chartId={id}
          dataKey={dataKey}
          fillOpacity={dotOpacity}
          type={variant}
        />
      );
    }

    if (child.type === ActiveDot) {
      const { variant } = (child as ReactElement<DotProps>).props;
      activeShape = (
        <ChartDot
          chartId={id}
          dataKey={dataKey}
          fillOpacity={dotOpacity}
          type={variant}
        />
      );
    }
  });

  return { shape, activeShape };
};

// ─────────────────────────────────────────────────────────────────────────────
// Custom bar shape
// ─────────────────────────────────────────────────────────────────────────────

// Props Recharts passes to a bar's custom shape renderer
interface BarShapeProps {
  background?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };
  dataKey?: string;
  fill?: string;
  fillOpacity?: number;
  height?: number;
  index?: number;
  width?: number;
  x?: number;
  y?: number;
  [key: string]: unknown;
}

type CustomBarProps = {
  id: string; // unique id of the owning <Bar />
  dataKey: string; // series key used for config-driven colors
  variant: BarVariant; // fill style of the bar
  barRadius: number; // corner radius of the bar
  colorSlots: number; // number of theme colors declared for this series
  filter?: string; // optional glow filter reference
  isClickable?: boolean; // whether the bar is selectable by click
  enableHoverHighlight?: boolean; // whether hovering a column dims the others
  animationType?: ComposedAnimationType; // grow-in order for this bar
  dataLength?: number; // total bars in the series — drives the stagger
  isRevealActive?: boolean; // whether the owning bar series is in its intro window
  onClick?: () => void; // fired when a clickable bar is clicked
} & BarShapeProps;

// Renders a single bar rectangle with its variant fill, glow, and hit area
const CustomBar = ({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  fillOpacity = 1,
  background,
  index = -1,
  id,
  dataKey,
  variant,
  barRadius,
  colorSlots,
  filter,
  isClickable,
  enableHoverHighlight,
  animationType = "none",
  dataLength = 0,
  isRevealActive = false,
  onClick,
}: CustomBarProps) => {
  const cursorStyle =
    isClickable || enableHoverHighlight ? { cursor: "pointer" } : undefined;
  const hitAreaX = background?.x ?? x;
  const hitAreaY = background?.y ?? y;
  const hitAreaWidth = background?.width ?? width;
  const hitAreaHeight = background?.height ?? height;

  const grow = getBarGrowAnimation(
    animationType,
    index,
    dataLength,
    isRevealActive
  );

  const getFill = () => {
    switch (variant) {
      case "hatched":
        return `url(#${id}-hatched)`;
      case "duotone":
        return `url(#${id}-duotone)`;
      case "duotone-reverse":
        return `url(#${id}-duotone-reverse)`;
      case "gradient":
        return `url(#${id}-gradient)`;
      case "stripped":
        return `url(#${id}-stripped)`;
      default:
        if (colorSlots > 1 && index >= 0) {
          return getChartColorVariable(dataKey, index, colorSlots - 1);
        }

        return `url(#${id}-bar-colors)`;
    }
  };

  // Full-height invisible rect — keeps the column hoverable even mid grow-in
  const hitArea = enableHoverHighlight ? (
    <rect
      fill="transparent"
      height={hitAreaHeight}
      width={hitAreaWidth}
      x={hitAreaX}
      y={hitAreaY}
    />
  ) : null;
  const interactiveProps = onClick
    ? {
        onClick,
        onKeyDown: (event: KeyboardEvent<SVGGElement>) => {
          if (event.key !== "Enter" && event.key !== " ") {
            return;
          }

          event.preventDefault();
          onClick();
        },
        role: "button",
        tabIndex: 0,
      }
    : {};

  if (variant === "stripped") {
    const strippedBar = (
      <>
        <rect fill={getFill()} height={height} width={width} x={x} y={y} />
        <rect
          fill={`url(#${id}-bar-colors)`}
          height={2}
          width={width}
          x={x}
          y={y}
        />
      </>
    );

    return (
      <g {...interactiveProps} style={cursorStyle}>
        {grow ? (
          <m.g
            animate={grow.animate}
            className="transition-opacity duration-200"
            filter={filter}
            opacity={fillOpacity}
            style={grow.style}
            transition={grow.transition}
          >
            {strippedBar}
          </m.g>
        ) : (
          <g
            className="transition-opacity duration-200"
            filter={filter}
            opacity={fillOpacity}
          >
            {strippedBar}
          </g>
        )}
        {hitArea}
      </g>
    );
  }

  const bar = (
    <rect
      className="transition-opacity duration-200"
      fill={getFill()}
      filter={filter}
      height={height}
      opacity={fillOpacity}
      rx={barRadius}
      ry={barRadius}
      width={width}
      x={x}
      y={y}
    />
  );

  return (
    <g {...interactiveProps} style={cursorStyle}>
      {grow ? (
        <m.g
          animate={grow.animate}
          style={grow.style}
          transition={grow.transition}
        >
          {bar}
        </m.g>
      ) : (
        bar
      )}
      {hitArea}
    </g>
  );
};

/**
 * Builds the motion.dev grow-in animation for a single bar, or returns `null`
 * when it should render statically (`"none"`, an unknown index, empty data, or
 * once the intro window is complete).
 *
 * The owning <Bar /> series owns its reveal window. Once the window ends, every
 * bar renders as plain SVG geometry, so long/offscreen content cannot leave
 * bars hidden behind stale animation transforms.
 */
const getBarGrowAnimation = (
  animationType: ComposedAnimationType,
  index: number,
  dataLength: number,
  isRevealActive: boolean
) => {
  if (
    animationType === "none" ||
    index < 0 ||
    dataLength <= 0 ||
    !isRevealActive
  ) {
    return null;
  }

  const step = getOrderedRevealStep(animationType, index, dataLength);

  return {
    animate: { scaleY: [0, 1] },
    transition: {
      duration: BAR_REVEAL_DURATION_MS / 1000,
      ease: REVEAL_EASE,
      delay: (step * BAR_REVEAL_STAGGER_MS) / 1000,
    },
    style: { originY: 1 }, // grow upward from the baseline
  };
};

// motion `originX` for each single-rect line reveal — the edge the wipe grows from
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
 * mask is applied to the line's stroke and its resting dots so both reveal in
 * lockstep, replacing Recharts' built-in animation.
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

// ─────────────────────────────────────────────────────────────────────────────
// Style definitions — one set per <Bar /> / <Line />, scoped to its unique id
// ─────────────────────────────────────────────────────────────────────────────

interface StyleProps {
  dataKey: string; // series key the colors belong to
  id: string; // unique id of the owning series
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

/** Vertical top-to-bottom color gradient — the fill source for every bar variant. */
const VerticalColorGradient = ({
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

/** Horizontal left-to-right color gradient for multi-stop line and dot paints. */
const HorizontalColorGradient = ({
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

/** Solid series gradient used by scatter dots and their active shape. */
const ScatterColorGradient = ({
  id,
  dataKey,
  config,
}: StyleProps & { config: ChartConfig }) => {
  const colorsCount = getColorsCount(config[dataKey] ?? {});

  return (
    <linearGradient
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

/** Hatched diagonal-stripe fill for a bar, masked from the series color gradient. */
const HatchedPattern = ({ id }: StyleProps) => (
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
const DuotonePattern = ({
  id,
  dataKey,
  config,
}: StyleProps & { config: ChartConfig }) => {
  const colorsCount = getColorsCount(config[dataKey] ?? {});

  return (
    <>
      <linearGradient
        gradientUnits="objectBoundingBox"
        id={`${id}-duotone-mask-gradient`}
        x1="0"
        x2="1"
        y1="0"
        y2="0"
      >
        <stop offset="50%" stopColor="white" stopOpacity={0.4} />
        <stop offset="50%" stopColor="white" stopOpacity={1} />
      </linearGradient>
      <linearGradient
        gradientUnits="objectBoundingBox"
        id={`${id}-duotone-colors`}
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
      <mask id={`${id}-duotone-mask`} maskContentUnits="objectBoundingBox">
        <rect
          fill={`url(#${id}-duotone-mask-gradient)`}
          height="1"
          width="1"
          x="0"
          y="0"
        />
      </mask>
      <pattern
        height="1"
        id={`${id}-duotone`}
        patternContentUnits="objectBoundingBox"
        patternUnits="objectBoundingBox"
        width="1"
      >
        <rect
          fill={`url(#${id}-duotone-colors)`}
          height="1"
          mask={`url(#${id}-duotone-mask)`}
          width="1"
          x="0"
          y="0"
        />
      </pattern>
    </>
  );
};

/** Two-tone fill mirrored from `duotone` — the full-strength half comes first. */
const DuotoneReversePattern = ({
  id,
  dataKey,
  config,
}: StyleProps & { config: ChartConfig }) => {
  const colorsCount = getColorsCount(config[dataKey] ?? {});

  return (
    <>
      <linearGradient
        gradientUnits="objectBoundingBox"
        id={`${id}-duotone-reverse-mask-gradient`}
        x1="0"
        x2="1"
        y1="0"
        y2="0"
      >
        <stop offset="50%" stopColor="white" stopOpacity={1} />
        <stop offset="50%" stopColor="white" stopOpacity={0.4} />
      </linearGradient>
      <linearGradient
        gradientUnits="objectBoundingBox"
        id={`${id}-duotone-reverse-colors`}
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
        id={`${id}-duotone-reverse-mask`}
        maskContentUnits="objectBoundingBox"
      >
        <rect
          fill={`url(#${id}-duotone-reverse-mask-gradient)`}
          height="1"
          width="1"
          x="0"
          y="0"
        />
      </mask>
      <pattern
        height="1"
        id={`${id}-duotone-reverse`}
        patternContentUnits="objectBoundingBox"
        patternUnits="objectBoundingBox"
        width="1"
      >
        <rect
          fill={`url(#${id}-duotone-reverse-colors)`}
          height="1"
          mask={`url(#${id}-duotone-reverse-mask)`}
          width="1"
          x="0"
          y="0"
        />
      </pattern>
    </>
  );
};

/** Gradient fill for a bar that fades from visible at the top toward transparent. */
const GradientPattern = ({ id }: StyleProps) => (
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
const StrippedPattern = ({ id }: StyleProps) => (
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
const BarGlowFilter = ({ id }: { id: string }) => (
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

/** Soft outer-glow filter applied to a glowing line. */
const LineGlowFilter = ({ id }: { id: string }) => (
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
export function useLoadingData(isLoading: boolean, loadingBars = 12) {
  const [_loadingDataKey, setLoadingDataKey] = useState(false);

  // Callback fired by motion.dev when the shimmer exits the visible area
  const onShimmerExit = useCallback(() => {
    if (isLoading) {
      setLoadingDataKey((prev) => !prev);
    }
  }, [isLoading]);

  const loadingData = useMemo(
    () => getLoadingData(loadingBars, 20, 80),
    // loadingDataKey toggle triggers re-computation when the shimmer exits
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loadingBars]
  );

  return { loadingData, onShimmerExit };
}

/**
 * The skeleton bar shown while the chart is loading. Rendered by the root in
 * place of the real bars and lines, paired with its own masked shimmer pattern.
 */
const LoadingBar = ({
  chartId,
  barRadius,
  onShimmerExit,
}: {
  chartId: string;
  barRadius: number;
  onShimmerExit: () => void;
}) => (
  <>
    <RechartsBar
      dataKey={LOADING_DATA_KEY}
      fill="currentColor"
      fillOpacity={0.15}
      isAnimationActive={false}
      legendType="none"
      radius={barRadius}
      style={{ mask: `url(#${chartId}-loading-mask)` }}
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
