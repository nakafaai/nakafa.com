"use client";

import type { AreaAnimationType } from "@repo/design-system/components/evilcharts/charts/area/paint";
import { ChartContainer } from "@repo/design-system/components/evilcharts/ui/chart";
import {
  axisValueToPercentFormatter,
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
import { LoadingArea } from "@repo/design-system/components/evilcharts/ui/loading";
import { LoadingIndicator } from "@repo/design-system/components/evilcharts/ui/loading-indicator";
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
  type Area as RechartsArea,
  AreaChart as RechartsAreaChart,
  XAxis as RechartsXAxis,
  YAxis as RechartsYAxis,
} from "recharts";

const STROKE_WIDTH = 0.8;
export type CurveType = ComponentProps<typeof RechartsArea>["type"];
type StackType = "default" | "expanded" | "stacked";

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
export function useAreaChart() {
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
  children: ReactNode; // composed parts ; <Area />, <XAxis />, <Legend />, …
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
  xDataKey?: keyof TData & string; // x-axis key ; only needed for the brush footer
}

type EvilAreaChartProps<
  TData extends Record<string, unknown>,
  TConfig extends Record<string, ChartConfig[string]>,
> = EvilAreaChartBaseProps<TData, TConfig>;

/**
 * Root of the composible area chart. Owns the data, the shared context, the
 * loading skeleton, and the optional zoom brush. Everything visual ; axes,
 * grid, tooltip, legend, and the areas themselves ; is composed as children,
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
  loadingPoints = 14,
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
  const loadingData = useMemo(
    () => getLoadingData(loadingPoints),
    [loadingPoints]
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
          {isLoading && <LoadingArea chartId={chartId} curveType={curveType} />}
        </RechartsAreaChart>
      </ChartContainer>
    </AreaChartContext>
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
