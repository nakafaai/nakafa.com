import {
  type ChartConfig,
  getChartColorVariable,
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
  const visibleKeys = new Set(keys);
  const gradients = Object.entries(chartConfig).flatMap(([dataKey, config]) => {
    if (!visibleKeys.has(dataKey)) {
      return [];
    }

    return [{ colorsCount: getColorsCount(config), dataKey }];
  });

  const dashArray =
    strokeVariant === "dashed" || strokeVariant === "animated-dashed"
      ? "4 4"
      : undefined;

  const definitions = (
    <>
      {variant === "area" && (
        <linearGradient
          id={`${chartId}-zm-vertical-fade`}
          x1="0"
          x2="0"
          y1="0"
          y2="1"
        >
          <stop offset="0%" stopColor="white" stopOpacity={0.15} />
          <stop offset="100%" stopColor="white" stopOpacity={0} />
        </linearGradient>
      )}
      {gradients.map(({ dataKey, colorsCount }) => {
        const colorStops =
          colorsCount === 1 ? (
            <>
              <stop offset="0%" stopColor={getChartColorVariable(dataKey, 0)} />
              <stop
                offset="100%"
                stopColor={getChartColorVariable(dataKey, 0)}
              />
            </>
          ) : (
            Array.from({ length: colorsCount }, (_, index) => {
              const offset = `${(index / (colorsCount - 1)) * 100}%`;

              return (
                <stop
                  key={`${dataKey}-${offset}`}
                  offset={offset}
                  stopColor={getChartColorVariable(dataKey, index, 0)}
                />
              );
            })
          );

        return (
          <React.Fragment key={dataKey}>
            <linearGradient
              id={getChartSeriesId(chartId, "zm", dataKey)}
              x1="0"
              x2="0"
              y1="0"
              y2="1"
            >
              {colorStops}
            </linearGradient>

            {variant === "area" && (
              <>
                <mask id={getChartSeriesId(chartId, "zm-fill-mask", dataKey)}>
                  <rect
                    fill={`url(#${chartId}-zm-vertical-fade)`}
                    height="100%"
                    width="100%"
                  />
                </mask>
                <pattern
                  height="100%"
                  id={getChartSeriesId(chartId, "zm-fill", dataKey)}
                  patternUnits="userSpaceOnUse"
                  width="100%"
                >
                  <rect
                    fill={`url(#${getChartSeriesId(chartId, "zm", dataKey)})`}
                    height="100%"
                    mask={`url(#${getChartSeriesId(chartId, "zm-fill-mask", dataKey)})`}
                    width="100%"
                  />
                </pattern>
              </>
            )}
          </React.Fragment>
        );
      })}
    </>
  );

  if (variant === "line") {
    return (
      <ResponsiveContainer height="100%" width="100%">
        <LineChart
          data={data}
          margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
        >
          <defs>{definitions}</defs>
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
          <defs>{definitions}</defs>
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
        <defs>{definitions}</defs>
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
