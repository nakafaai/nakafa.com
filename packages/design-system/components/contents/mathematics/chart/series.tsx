import { Bar } from "@repo/design-system/components/evilcharts/charts/composed/bar";
import { Line } from "@repo/design-system/components/evilcharts/charts/composed/line";
import {
  EvilComposedChart,
  Grid,
  XAxis,
  YAxis,
} from "@repo/design-system/components/evilcharts/charts/composed-chart";
import type { ChartConfig } from "@repo/design-system/components/evilcharts/ui/chart-config";
import {
  ChartTooltip,
  ChartTooltipContent,
} from "@repo/design-system/components/evilcharts/ui/tooltip";
import {
  VisualCard,
  VisualCardActions,
  VisualCardBody,
  VisualCardFullscreen,
  VisualCardHeader,
} from "@repo/design-system/components/visual/card";
import { Array as Arr, Record as Rec } from "effect";
import { type ReactNode, useMemo } from "react";

/** The palette a chart's series take in order, one color each. */
const SERIES_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

/** The key of one series in the rows the chart draws. */
const seriesKey = (index: number) => `series${index}`;

/** The color of one series, the palette repeating past its end. */
const seriesColor = (index: number) =>
  SERIES_COLORS[index % SERIES_COLORS.length];

/**
 * Categories along one axis and named series of values over them, each drawn as bars or as a line.
 * Bars stand apart, as a bar chart's do, or touching, as a histogram's classes do. A missing value
 * leaves its category empty in that series.
 */
export function SeriesChart({
  bars = "apart",
  categories,
  description,
  series,
  title,
  valueLabel,
  valueRange,
}: {
  readonly bars?: "apart" | "touching" | undefined;
  readonly categories: readonly string[];
  readonly description: ReactNode;
  readonly series: readonly {
    readonly label: string;
    readonly mark: "bar" | "line";
    readonly values: readonly (number | null)[];
  }[];
  readonly title: ReactNode;
  readonly valueLabel?: string | undefined;
  readonly valueRange?:
    | { readonly max: number; readonly min: number }
    | undefined;
}) {
  const config = useMemo(
    () =>
      Rec.fromEntries(
        Arr.map(series, (item, index) => [
          seriesKey(index),
          {
            colors: {
              dark: [seriesColor(index)],
              light: [seriesColor(index)],
            },
            label: item.label,
          },
        ])
      ) satisfies ChartConfig,
    [series]
  );
  const rows = useMemo(
    () =>
      Arr.map(
        categories,
        (name, category): Record<string, string | number | null> => ({
          name,
          ...Rec.fromEntries(
            Arr.map(series, (item, index): readonly [string, number | null] => [
              seriesKey(index),
              item.values[category] ?? null,
            ])
          ),
        })
      ),
    [categories, series]
  );

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardBody className="p-(--card-spacing)">
        <EvilComposedChart
          {...(bars === "touching" ? { barCategoryGap: 0, barGap: 0 } : {})}
          className="aspect-video"
          config={config}
          data={rows}
        >
          <Grid vertical={false} />
          <XAxis dataKey="name" tickMargin={10} />
          <YAxis
            tickMargin={10}
            {...(valueRange === undefined
              ? {}
              : { domain: [valueRange.min, valueRange.max] })}
            {...(valueLabel === undefined
              ? {}
              : {
                  label: {
                    angle: -90,
                    position: "insideLeft",
                    style: { textAnchor: "middle" },
                    value: valueLabel,
                  },
                })}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          {Arr.map(series, (item, index) =>
            item.mark === "bar" ? (
              <Bar
                dataKey={seriesKey(index)}
                key={seriesKey(index)}
                radius={bars === "touching" ? 0 : 4}
              />
            ) : (
              <Line
                dataKey={seriesKey(index)}
                key={seriesKey(index)}
                lineProps={{ activeDot: { r: 6 }, dot: { r: 4 } }}
              />
            )
          )}
        </EvilComposedChart>
      </VisualCardBody>
      <VisualCardActions>
        <VisualCardFullscreen />
      </VisualCardActions>
    </VisualCard>
  );
}
