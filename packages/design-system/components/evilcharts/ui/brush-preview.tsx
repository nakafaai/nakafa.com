import { BrushDefinitions } from "@repo/design-system/components/evilcharts/ui/brush-paint";
import {
  type ChartConfig,
  getChartSeriesId,
  getChartSeriesPaint,
  getColorsCount,
} from "@repo/design-system/components/evilcharts/ui/chart-config";
import type { EvilBrushVariant } from "@repo/design-system/components/evilcharts/ui/evil-brush";
import * as React from "react";

type RechartsModule = typeof import("recharts");

/** Recharts interpolation supported by the miniature brush preview. */
type EvilBrushCurveType = React.ComponentProps<RechartsModule["Area"]>["type"];

interface EvilBrushPreviewProps {
  barRadius?: number;
  chartConfig: ChartConfig;
  chartId: string;
  connectNulls: boolean;
  curveType: EvilBrushCurveType;
  data: Record<string, unknown>[];
  keys: string[];
  stacked: boolean;
  strokeVariant?: "solid" | "dashed" | "animated-dashed";
  variant: EvilBrushVariant;
}

/** Builds the preview after every Recharts primitive loads as one module. */
function renderEvilBrushPreview(
  {
    data,
    keys,
    chartConfig,
    variant,
    curveType,
    chartId,
    stacked,
    strokeVariant = "solid",
    connectNulls,
    barRadius,
  }: EvilBrushPreviewProps,
  {
    Area,
    AreaChart,
    Bar,
    BarChart,
    Line,
    LineChart,
    ResponsiveContainer,
  }: RechartsModule
) {
  const dashArray =
    strokeVariant === "dashed" || strokeVariant === "animated-dashed"
      ? "4 4"
      : undefined;

  if (variant === "line") {
    return (
      <ResponsiveContainer height="100%" width="100%">
        <LineChart
          data={data}
          margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
        >
          <defs>
            <BrushDefinitions
              chartConfig={chartConfig}
              chartId={chartId}
              keys={keys}
              variant={variant}
            />
          </defs>
          {keys.map((dataKey) => (
            <Line
              activeDot={false}
              connectNulls={connectNulls}
              dataKey={dataKey}
              dot={false}
              isAnimationActive={false}
              key={dataKey}
              stroke={getChartSeriesPaint(
                chartId,
                "zm",
                dataKey,
                getColorsCount(chartConfig[dataKey] ?? {})
              )}
              strokeDasharray={dashArray}
              strokeOpacity={0.5}
              strokeWidth={1}
              type={curveType}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (variant === "bar") {
    const radius = barRadius ?? 3;

    return (
      <ResponsiveContainer height="100%" width="100%">
        <BarChart
          barGap={2}
          barSize={14}
          data={data}
          margin={{ top: 2, right: 0, bottom: 0, left: 0 }}
        >
          <defs>
            <BrushDefinitions
              chartConfig={chartConfig}
              chartId={chartId}
              keys={keys}
              variant={variant}
            />
          </defs>
          {keys.map((dataKey) => (
            <Bar
              dataKey={dataKey}
              fill={`url(#${getChartSeriesId(chartId, "zm", dataKey)})`}
              fillOpacity={0.35}
              isAnimationActive={false}
              key={dataKey}
              radius={[radius, radius, radius, radius]}
              stackId={stacked ? "zm-stack" : undefined}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer height="100%" width="100%">
      <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <BrushDefinitions
            chartConfig={chartConfig}
            chartId={chartId}
            keys={keys}
            variant={variant}
          />
        </defs>
        {keys.map((dataKey) => (
          <Area
            activeDot={false}
            connectNulls={connectNulls}
            dataKey={dataKey}
            dot={false}
            fill={`url(#${getChartSeriesId(chartId, "zm-fill", dataKey)})`}
            fillOpacity={1}
            isAnimationActive={false}
            key={dataKey}
            stackId={stacked ? "zm-stack" : undefined}
            stroke={getChartSeriesPaint(
              chartId,
              "zm",
              dataKey,
              getColorsCount(chartConfig[dataKey] ?? {})
            )}
            strokeDasharray={dashArray}
            strokeOpacity={0.5}
            strokeWidth={1}
            type={curveType}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Renders the complete dataset behind the brush selection controls. */
const EvilBrushPreview = React.lazy(() =>
  import("recharts").then((recharts) => ({
    default: (props: EvilBrushPreviewProps) =>
      renderEvilBrushPreview(props, recharts),
  }))
);

export { type EvilBrushCurveType, EvilBrushPreview };
