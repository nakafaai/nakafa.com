"use client";

import type { LineAnimationType } from "@repo/design-system/components/evilcharts/charts/line/paint";
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
import { LoadingLine } from "@repo/design-system/components/evilcharts/ui/loading";
import { LoadingIndicator } from "@repo/design-system/components/evilcharts/ui/loading-indicator";
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
  type Line as RechartsLine,
  LineChart as RechartsLineChart,
  XAxis as RechartsXAxis,
  YAxis as RechartsYAxis,
} from "recharts";

// Constants
export const STROKE_WIDTH = 1;

export type CurveType = NonNullable<
  ComponentProps<typeof RechartsLine>["type"]
>;

// Shared context

const LineChartStateSchema = Schema.Struct({
  animationType: RevealAnimationSchema, // default intro reveal each <Line /> inherits
  isLoading: Schema.Boolean, // whether the chart shows its loading skeleton
  selectedDataKey: Schema.NullOr(Schema.String), // currently selected series, or null when none
});

type SelectDataKey = (dataKey: string | null) => void; // sets the selected series

/**
 * Builds the shared value of the chart. `config` holds the colors and labels of
 * every series, while `animationType` and `curveType` are the defaults each
 * <Line /> inherits. The context type is derived from this hook.
 */
function useLineChartValue(
  {
    animationType,
    isLoading,
    selectedDataKey,
  }: typeof LineChartStateSchema.Type,
  config: ChartConfig,
  curveType: CurveType,
  selectDataKey: SelectDataKey
) {
  return useMemo(
    () => ({
      animationType,
      config,
      curveType,
      isLoading,
      selectDataKey,
      selectedDataKey,
    }),
    [
      animationType,
      config,
      curveType,
      isLoading,
      selectDataKey,
      selectedDataKey,
    ]
  );
}

/**
 * Shared state for every part of the chart. Lifted into <EvilLineChart /> so that
 * <Line />, <XAxis />, <Legend />, and friends can read it without prop drilling.
 * Sub-components are composed freely, the provider is the single source of truth.
 */
type LineChartContextValue = ReturnType<typeof useLineChartValue>;

const LineChartContext = createContext<LineChartContextValue | null>(null);

// Selects one part of the chart context, throwing a helpful error when used outside <EvilLineChart />
export function useLineChart<T>(selector: (chart: LineChartContextValue) => T) {
  const value = use(LineChartContext);

  if (!value) {
    throw new Error(
      "Line chart parts (<Line />, <XAxis />, …) must be used within <EvilLineChart />"
    );
  }

  return selector(value);
}

// Root container

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
  children: ReactNode; // composed parts, <Line />, <XAxis />, <Legend />, …
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
  xDataKey?: keyof TData & string; // x-axis key, only needed for the brush footer
}

type EvilLineChartProps<
  TData extends Record<string, unknown>,
  TConfig extends Record<string, ChartConfig[string]>,
> = EvilLineChartBaseProps<TData, TConfig>;

/**
 * Root of the composible line chart. Owns the data, the shared context, the
 * loading skeleton, and the optional zoom brush. Everything visual, axes,
 * grid, tooltip, legend, and the lines themselves, is composed as children,
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
  const loadingData = useMemo(
    () => getLoadingData(loadingPoints, 20, 80),
    [loadingPoints]
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

  const contextValue = useLineChartValue(
    { animationType, isLoading, selectedDataKey },
    config,
    curveType,
    selectDataKey
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
              strokeWidth={STROKE_WIDTH}
            />
          )}
        </RechartsLineChart>
      </ChartContainer>
    </LineChartContext>
  );
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
  const isLoading = useLineChart((chart) => chart.isLoading);

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
  const isLoading = useLineChart((chart) => chart.isLoading);

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
  const isLoading = useLineChart((chart) => chart.isLoading);
  const selectedDataKey = useLineChart((chart) => chart.selectedDataKey);

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
 * its series, driving the shared selection state read by every <Line />.
 */
export function Legend({
  variant,
  align = "right",
  verticalAlign = "top",
  isClickable = false,
}: LegendProps) {
  const selectedDataKey = useLineChart((chart) => chart.selectedDataKey);
  const selectDataKey = useLineChart((chart) => chart.selectDataKey);

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
