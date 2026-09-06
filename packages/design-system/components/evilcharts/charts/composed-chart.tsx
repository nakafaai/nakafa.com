"use client";

import { ChartContainer } from "@repo/design-system/components/evilcharts/ui/chart";
import {
  type ChartConfig,
  getLoadingData,
} from "@repo/design-system/components/evilcharts/ui/chart-config";
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
import { LoadingBar } from "@repo/design-system/components/evilcharts/ui/loading";
import { LoadingIndicator } from "@repo/design-system/components/evilcharts/ui/loading-indicator";
import type { OrderedRevealAnimation } from "@repo/design-system/components/evilcharts/ui/reveal-animation";
import {
  ChartTooltip,
  ChartTooltipContent,
  type TooltipRoundness,
  type TooltipVariant,
} from "@repo/design-system/components/evilcharts/ui/tooltip";
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  use,
  useCallback,
  useId,
  useMemo,
  useState,
} from "react";
import {
  CartesianGrid,
  ComposedChart as RechartsComposedChart,
  type Line as RechartsLine,
  ReferenceLine as RechartsReferenceLine,
  XAxis as RechartsXAxis,
  YAxis as RechartsYAxis,
} from "recharts";

// Constants
export const STROKE_WIDTH = 2;

export const DEFAULT_BAR_RADIUS = 4;

export type CurveType = ComponentProps<typeof RechartsLine>["type"];

/**
 * Direction of the custom motion.dev intro. Recharts' own animation is
 * permanently disabled, lines wipe in along this direction, while bars grow up
 * from their baseline staggered in this same order.
 *
 * NOTE: the intro is a per-frame animation, heavier than a static chart.
 * `"none"` opts out, as does a device with the OS "reduce motion" preference.
 */
export type ComposedAnimationType = "none" | OrderedRevealAnimation;

// Shared context

/**
 * Shared state for every part of the chart. Lifted into <EvilComposedChart /> so
 * that <Bar />, <Line />, <XAxis />, <Legend />, and friends can read it without
 * prop drilling. Sub-components are composed freely, the provider is the single
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
export function useComposedChart() {
  const context = use(ComposedChartContext);

  if (!context) {
    throw new Error(
      "Composed chart parts (<Bar />, <Line />, <XAxis />, …) must be used within <EvilComposedChart />"
    );
  }

  return context;
}

// Root container

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
  children: ReactNode; // composed parts, <Bar />, <Line />, <XAxis />, <Legend />, …
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
  xDataKey?: keyof TData & string; // x-axis key, only needed for the brush footer
}

type EvilComposedChartProps<
  TData extends Record<string, unknown>,
  TConfig extends Record<string, ChartConfig[string]>,
> = EvilComposedChartBaseProps<TData, TConfig>;

/**
 * Root of the composible composed chart. Owns the data, the shared context, the
 * loading skeleton, and the optional zoom brush. Everything visual, axes, grid,
 * tooltip, legend, and the bars and lines themselves, is composed as children,
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
  const loadingData = useMemo(
    () => getLoadingData(loadingBars, 20, 80),
    [loadingBars]
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
            <LoadingBar barRadius={DEFAULT_BAR_RADIUS} chartId={chartId} />
          )}
        </RechartsComposedChart>
      </ChartContainer>
    </ComposedChartContext>
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

// Selection + dot helpers

// Returns stroke/dot opacity for a line, dims a series only when another is selected
export const getOpacity = (selectedDataKey: string | null, dataKey: string) => {
  if (selectedDataKey === null) {
    return { stroke: 1, dot: 1 };
  }

  return selectedDataKey === dataKey
    ? { stroke: 1, dot: 1 }
    : { stroke: 0.3, dot: 0.3 };
};
