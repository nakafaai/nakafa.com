import { BrushDefinitions } from "@repo/design-system/components/evilcharts/ui/brush-paint";
import {
  type ChartBrushOptions,
  useChart,
} from "@repo/design-system/components/evilcharts/ui/chart";
import {
  type ChartConfig,
  getChartSeriesId,
  getChartSeriesPaint,
  getColorsCount,
} from "@repo/design-system/components/evilcharts/ui/chart-config";
import { Array as Arr } from "effect";
import { type ComponentProps, lazy } from "react";

type RechartsModule = typeof import("recharts");

/** Recharts interpolation supported by the miniature brush preview. */
type EvilBrushCurveType = NonNullable<
  ComponentProps<RechartsModule["Area"]>["type"]
>;

/** The props that EvilBrush hands to its preview. */
interface EvilBrushPreviewProps {
  chartConfig: ChartConfig;
  chartId: string;
  data: Record<string, unknown>[];
  keys: string[];
  strokeVariant?: "solid" | "dashed" | "animated-dashed";
}

/** The look of the preview: the chart's brush options with the brush defaults applied. */
type EvilBrushLook = {
  [Key in "curveType" | "stacked" | "variant"]-?: NonNullable<
    ChartBrushOptions[Key]
  >;
} & Pick<ChartBrushOptions, "barRadius">;

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
    barRadius,
  }: EvilBrushPreviewProps & EvilBrushLook,
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
          {Arr.map(keys, (dataKey) => (
            <Line
              activeDot={false}
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
              {...(dashArray === undefined
                ? {}
                : { strokeDasharray: dashArray })}
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
          {Arr.map(keys, (dataKey) => (
            <Bar
              dataKey={dataKey}
              fill={`url(#${getChartSeriesId(chartId, "zm", dataKey)})`}
              fillOpacity={0.35}
              isAnimationActive={false}
              key={dataKey}
              radius={[radius, radius, radius, radius]}
              {...(stacked ? { stackId: "zm-stack" } : {})}
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
        {Arr.map(keys, (dataKey) => (
          <Area
            activeDot={false}
            dataKey={dataKey}
            dot={false}
            fill={`url(#${getChartSeriesId(chartId, "zm-fill", dataKey)})`}
            fillOpacity={1}
            isAnimationActive={false}
            key={dataKey}
            {...(stacked ? { stackId: "zm-stack" } : {})}
            stroke={getChartSeriesPaint(
              chartId,
              "zm",
              dataKey,
              getColorsCount(chartConfig[dataKey] ?? {})
            )}
            {...(dashArray === undefined ? {} : { strokeDasharray: dashArray })}
            strokeOpacity={0.5}
            strokeWidth={1}
            type={curveType}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Renders the complete dataset behind the brush selection controls, styled by the chart's brush options. */
const EvilBrushPreview = lazy(() =>
  import("recharts").then((recharts) => {
    const EvilBrushPreviewWithLook = (props: EvilBrushPreviewProps) => {
      const {
        barRadius,
        curveType = "monotone",
        stacked = false,
        variant = "area",
      } = useChart((chart) => chart.brush);

      return renderEvilBrushPreview(
        { ...props, barRadius, curveType, stacked, variant },
        recharts
      );
    };

    return { default: EvilBrushPreviewWithLook };
  })
);

export { type EvilBrushCurveType, EvilBrushPreview };
