"use client";

import {
  type BackgroundVariant,
  ChartBackground,
} from "@repo/design-system/components/evilcharts/ui/background";
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
import { RevealAnimationSchema } from "@repo/design-system/components/evilcharts/ui/reveal-animation";
import {
  ChartTooltip,
  ChartTooltipContent,
  type TooltipRoundness,
  type TooltipVariant,
} from "@repo/design-system/components/evilcharts/ui/tooltip";
import { Schema } from "effect";
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
  BarChart as RechartsBarChart,
  XAxis as RechartsXAxis,
  YAxis as RechartsYAxis,
  ReferenceLine,
} from "recharts";

// Constants
export const DEFAULT_BAR_RADIUS = 2;

type StackType = "default" | "stacked" | "percent";

type BarLayout = "vertical" | "horizontal";

/**
 * Order in which bars grow into view. Recharts' own bar animation is permanently
 * disabled, every bar instead grows from its baseline (bottom for vertical
 * layout, left for horizontal), and this controls the stagger sequence.
 *
 * NOTE: the grow-in is a per-frame animation, so it is heavier than a static
 * chart. `"none"` opts out entirely; it is also what a device with the OS
 * "reduce motion" preference falls back to automatically.
 */
export type BarAnimationType = "none" | OrderedRevealAnimation;

// Shared context

const BarChartStateSchema = Schema.Struct({
  animationType: RevealAnimationSchema, // default grow-in order each <Bar /> inherits
  barRadius: Schema.Finite, // default corner radius each <Bar /> inherits
  dataLength: Schema.Finite, // number of rows currently rendered
  isHorizontal: Schema.Boolean, // whether bars are laid out horizontally
  isLoading: Schema.Boolean, // whether the chart shows its loading skeleton
  isMouseInChart: Schema.Boolean, // whether the pointer is currently over the chart
  isStacked: Schema.Boolean, // whether bars stack on top of each other
  selectedDataKey: Schema.NullOr(Schema.String), // currently selected series, or null when none
});

type SelectDataKey = (dataKey: string | null) => void; // sets the selected series

/**
 * Builds the shared value of the chart. `config` holds the colors and labels of
 * every series, and `animationType` is the default grow-in order each <Bar />
 * inherits. The context type is derived from this hook.
 */
function useBarChartValue(
  {
    animationType,
    barRadius,
    dataLength,
    isHorizontal,
    isLoading,
    isMouseInChart,
    isStacked,
    selectedDataKey,
  }: typeof BarChartStateSchema.Type,
  config: ChartConfig,
  selectDataKey: SelectDataKey
) {
  return useMemo(
    () => ({
      animationType,
      barRadius,
      config,
      dataLength,
      isHorizontal,
      isLoading,
      isMouseInChart,
      isStacked,
      selectDataKey,
      selectedDataKey,
    }),
    [
      animationType,
      barRadius,
      config,
      dataLength,
      isHorizontal,
      isLoading,
      isMouseInChart,
      isStacked,
      selectDataKey,
      selectedDataKey,
    ]
  );
}

/**
 * Shared state for every part of the chart. Lifted into <EvilBarChart /> so that
 * <Bar />, <XAxis />, <Legend />, and friends can read it without prop drilling.
 * Sub-components are composed freely, the provider is the single source of truth.
 */
type BarChartContextValue = ReturnType<typeof useBarChartValue>;

const BarChartContext = createContext<BarChartContextValue | null>(null);

// Selects one part of the chart context, throwing a helpful error when used outside <EvilBarChart />
export function useBarChart<T>(selector: (chart: BarChartContextValue) => T) {
  const value = use(BarChartContext);

  if (!value) {
    throw new Error(
      "Bar chart parts (<Bar />, <XAxis />, …) must be used within <EvilBarChart />"
    );
  }

  return selector(value);
}

// Root container

// Validates that every config key also exists on the data row type
type ValidateConfigKeys<TData, TConfig> = {
  [K in keyof TConfig]: K extends keyof TData ? ChartConfig[string] : never;
};

interface EvilBarChartBaseProps<
  TData extends Record<string, unknown>,
  TConfig extends Record<string, ChartConfig[string]>,
> {
  animationType?: BarAnimationType; // default grow-in order for every <Bar />
  backgroundVariant?: BackgroundVariant; // background pattern drawn behind the chart
  barCategoryGap?: number; // gap between categories of bars
  barGap?: number; // gap between bars within the same category
  barRadius?: number; // default corner radius for every <Bar />
  brushFormatLabel?: (value: unknown, index: number) => string; // formats brush axis labels
  brushHeight?: number; // height of the brush preview in pixels
  chartProps?: ComponentProps<typeof RechartsBarChart>; // escape hatch for the raw Recharts chart
  children: ReactNode; // composed parts, <Bar />, <XAxis />, <Legend />, …
  className?: string; // extra classes for the chart container
  config: TConfig & ValidateConfigKeys<TData, TConfig>; // series colors + labels
  data: TData[]; // rows rendered by the chart
  defaultSelectedDataKey?: string | null; // series selected on first render
  isLoading?: boolean; // shows the animated loading skeleton
  layout?: BarLayout; // orientation of the bars
  loadingBars?: number; // number of bars in the loading skeleton
  onBrushChange?: (range: EvilBrushRange) => void; // fires when the brush range changes
  onSelectionChange?: (selectedDataKey: string | null) => void; // fires when the selected series changes
  showBrush?: boolean; // renders a zoom brush below the chart
  stackType?: StackType; // how multiple bars combine
  xDataKey?: keyof TData & string; // x-axis key, only needed for the brush footer
}

type EvilBarChartProps<
  TData extends Record<string, unknown>,
  TConfig extends Record<string, ChartConfig[string]>,
> = EvilBarChartBaseProps<TData, TConfig>;

/**
 * Root of the composible bar chart. Owns the data, the shared context, the
 * loading skeleton, and the optional zoom brush. Everything visual, axes,
 * grid, tooltip, legend, and the bars themselves, is composed as children,
 * so a consumer renders exactly the parts they need.
 */
export function EvilBarChart<
  TData extends Record<string, unknown>,
  TConfig extends Record<string, ChartConfig[string]>,
>({
  config,
  data,
  children,
  className,
  chartProps,
  stackType = "default",
  layout = "vertical",
  barRadius = DEFAULT_BAR_RADIUS,
  animationType = "left-to-right",
  barGap,
  barCategoryGap,
  backgroundVariant,
  defaultSelectedDataKey = null,
  onSelectionChange,
  isLoading = false,
  loadingBars,
  showBrush = false,
  xDataKey,
  brushHeight,
  brushFormatLabel,
  onBrushChange,
}: EvilBarChartProps<TData, TConfig>) {
  const chartId = useId().replace(/:/g, ""); // colon-free id keeps CSS/SVG selectors valid
  const [selectedDataKey, setSelectedDataKey] = useState<string | null>(
    defaultSelectedDataKey
  );
  const [isMouseInChart, setIsMouseInChart] = useState(false);
  const loadingData = useMemo(
    () => getLoadingData(loadingBars, 20, 80),
    [loadingBars]
  );
  const { visibleData, brushProps } = useEvilBrush({ data });

  const isStacked = stackType === "stacked" || stackType === "percent";
  const isHorizontal = layout === "horizontal";
  const displayData = showBrush && !isLoading ? visibleData : data;

  // Updates selection state and notifies the parent
  const selectDataKey = useCallback(
    (newSelectedDataKey: string | null) => {
      setSelectedDataKey(newSelectedDataKey);
      onSelectionChange?.(newSelectedDataKey);
    },
    [onSelectionChange]
  );

  const contextValue = useBarChartValue(
    {
      animationType,
      barRadius,
      dataLength: displayData.length,
      isHorizontal,
      isLoading,
      isMouseInChart,
      isStacked,
      selectedDataKey,
    },
    config,
    selectDataKey
  );

  return (
    <BarChartContext value={contextValue}>
      <ChartContainer
        className={className}
        config={config}
        footer={
          showBrush &&
          !isLoading && (
            <EvilBrush
              barRadius={barRadius}
              chartConfig={config}
              className="mt-1"
              data={data}
              formatLabel={brushFormatLabel}
              height={brushHeight}
              skipStyle
              stacked={isStacked}
              variant="bar"
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
        <RechartsBarChart
          accessibilityLayer
          {...(barCategoryGap === undefined ? {} : { barCategoryGap })}
          {...(barGap === undefined ? {} : { barGap })}
          data={isLoading ? loadingData : displayData}
          id={chartId}
          layout={isHorizontal ? "vertical" : "horizontal"}
          onMouseEnter={() => setIsMouseInChart(true)}
          onMouseLeave={() => setIsMouseInChart(false)}
          {...(stackType === "percent" ? { stackOffset: "expand" } : {})}
          {...chartProps}
        >
          {backgroundVariant && <ChartBackground variant={backgroundVariant} />}
          <ReferenceLine color="white" />
          {children}
          {isLoading && (
            <LoadingBar barRadius={DEFAULT_BAR_RADIUS} chartId={chartId} />
          )}
        </RechartsBarChart>
      </ChartContainer>
    </BarChartContext>
  );
}

type XAxisProps = ComponentProps<typeof RechartsXAxis>;

/**
 * The category axis. Ships with the chart's flat default styling and forwards
 * every Recharts XAxis prop, so `dataKey`, `tickFormatter`, etc. are passed
 * straight through. Hidden automatically while the chart is loading. Resolves
 * its axis type from the chart layout, categorical when vertical, numeric
 * when the bars run horizontally.
 */
export function XAxis({
  tickLine = false,
  axisLine = false,
  tickMargin = 8,
  minTickGap = 8,
  type,
  ...props
}: XAxisProps) {
  const isLoading = useBarChart((chart) => chart.isLoading);
  const isHorizontal = useBarChart((chart) => chart.isHorizontal);

  if (isLoading) {
    return null;
  }

  return (
    <RechartsXAxis
      axisLine={axisLine}
      minTickGap={minTickGap}
      tickLine={tickLine}
      tickMargin={tickMargin}
      type={type ?? (isHorizontal ? "number" : "category")}
      {...props}
    />
  );
}

type YAxisProps = ComponentProps<typeof RechartsYAxis>;

/**
 * The value axis. Forwards every Recharts YAxis prop and resolves its axis type
 * from the chart layout, numeric when vertical, categorical when the bars run
 * horizontally. Hidden automatically while the chart is loading.
 */
export function YAxis({
  tickLine = false,
  axisLine = false,
  tickMargin = 8,
  minTickGap = 8,
  width = "auto",
  type,
  ...props
}: YAxisProps) {
  const isLoading = useBarChart((chart) => chart.isLoading);
  const isHorizontal = useBarChart((chart) => chart.isHorizontal);

  if (isLoading) {
    return null;
  }

  return (
    <RechartsYAxis
      axisLine={axisLine}
      minTickGap={minTickGap}
      tickLine={tickLine}
      tickMargin={tickMargin}
      type={type ?? (isHorizontal ? "category" : "number")}
      width={width}
      {...props}
    />
  );
}

type GridProps = ComponentProps<typeof CartesianGrid>;

/**
 * The background grid lines. Defaults to dashed lines aligned to the value
 * axis based on the chart layout, and forwards every Recharts CartesianGrid
 * prop for full control.
 */
export function Grid({
  strokeDasharray = "3 3",
  vertical,
  horizontal,
  ...props
}: GridProps) {
  const isHorizontal = useBarChart((chart) => chart.isHorizontal);

  return (
    <CartesianGrid
      horizontal={horizontal ?? !isHorizontal}
      strokeDasharray={strokeDasharray}
      vertical={vertical ?? isHorizontal}
      {...props}
    />
  );
}

interface TooltipProps {
  defaultIndex?: number; // data index shown by default with no hover
  roundness?: TooltipRoundness; // border-radius of the tooltip
  variant?: TooltipVariant; // visual style of the tooltip surface
}

/**
 * The hover tooltip. Reads the chart's selection from context so its content
 * dims unselected series. Hidden automatically while the chart is loading.
 */
export function Tooltip({ variant, roundness, defaultIndex }: TooltipProps) {
  const isLoading = useBarChart((chart) => chart.isLoading);
  const selectedDataKey = useBarChart((chart) => chart.selectedDataKey);

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
      cursor={false}
      {...(defaultIndex === undefined ? {} : { defaultIndex })}
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
 * its series, driving the shared selection state read by every <Bar />.
 */
export function Legend({
  variant,
  align = "right",
  verticalAlign = "top",
  isClickable = false,
}: LegendProps) {
  const selectedDataKey = useBarChart((chart) => chart.selectedDataKey);
  const selectDataKey = useBarChart((chart) => chart.selectDataKey);

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
