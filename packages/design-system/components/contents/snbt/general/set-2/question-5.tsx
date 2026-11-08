import { ChartDataProvider } from "@repo/design-system/components/contents/mathematics/chart/context";
import { ChartSeriesFacts } from "@repo/design-system/components/contents/mathematics/chart/facts";
import { Bar } from "@repo/design-system/components/evilcharts/charts/bar/series";
import {
  EvilBarChart,
  Grid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from "@repo/design-system/components/evilcharts/charts/bar-chart";
import type { ChartConfig } from "@repo/design-system/components/evilcharts/ui/chart-config";
import {
  VisualCard,
  VisualCardActions,
  VisualCardBody,
  VisualCardFooter,
  VisualCardFullscreen,
  VisualCardHeader,
} from "@repo/design-system/components/visual/card";
import { getBarSeriesCue } from "@repo/design-system/lib/charts/series-cue";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Record as Rec } from "effect";
import { type ReactNode, useMemo } from "react";

const chartData = [
  { year: "2011", shirts: 50, pants: 60, suits: 40 },
  { year: "2012", shirts: 35, pants: 60, suits: 55 },
  { year: "2013", shirts: 20, pants: 50, suits: 45 },
  { year: "2014", shirts: 70, pants: 40, suits: 60 },
  { year: "2015", shirts: 55, pants: 40, suits: 50 },
];

interface Props {
  description: ReactNode;
  seriesLabels: {
    pants: string;
    shirts: string;
    suits: string;
  };
  title: ReactNode;
  yAxisLabel: string;
}

/** Renders the factory outlet sales chart with MDX-owned copy. */
export function SalesChart({
  description,
  seriesLabels,
  title,
  yAxisLabel,
}: Props) {
  const chartConfig = useMemo(
    () =>
      ({
        shirts: {
          cue: getBarSeriesCue(0),
          label: seriesLabels.shirts,
          colors: { light: [PLOT_COLORS.orange], dark: [PLOT_COLORS.orange] },
        },
        pants: {
          cue: getBarSeriesCue(1),
          label: seriesLabels.pants,
          colors: { light: [PLOT_COLORS.teal], dark: [PLOT_COLORS.teal] },
        },
        suits: {
          cue: getBarSeriesCue(2),
          label: seriesLabels.suits,
          colors: { light: [PLOT_COLORS.violet], dark: [PLOT_COLORS.violet] },
        },
      }) satisfies ChartConfig,
    [seriesLabels.pants, seriesLabels.shirts, seriesLabels.suits]
  );

  const chartSummary = useMemo(
    () => ({
      categories: Arr.map(chartData, (row) => row.year),
      series: [
        {
          key: "shirts",
          label: chartConfig.shirts.label,
          color: chartConfig.shirts.colors.light[0],
          values: Arr.map(chartData, (row) => row.shirts),
        },
        {
          key: "pants",
          label: chartConfig.pants.label,
          color: chartConfig.pants.colors.light[0],
          values: Arr.map(chartData, (row) => row.pants),
        },
        {
          key: "suits",
          label: chartConfig.suits.label,
          color: chartConfig.suits.colors.light[0],
          values: Arr.map(chartData, (row) => row.suits),
        },
      ],
    }),
    [chartConfig]
  );

  return (
    <ChartDataProvider data={chartSummary}>
      <VisualCard>
        <VisualCardHeader description={description} title={title} />
        <VisualCardBody className="p-(--card-spacing)">
          <EvilBarChart
            className="aspect-video"
            config={chartConfig}
            data={chartData}
          >
            <Grid vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="year"
              tickLine={false}
              tickMargin={10}
            />
            <YAxis
              axisLine={false}
              label={{
                value: yAxisLabel,
                angle: -90,
                position: "insideLeft",
              }}
              tickLine={false}
              tickMargin={10}
            />
            <Tooltip />
            <Legend />
            {Arr.map(Rec.keys(chartConfig), (key, index) => {
              const cue = getBarSeriesCue(index);

              return (
                <Bar
                  dataKey={key}
                  key={key}
                  radius={cue.radius}
                  variant={cue.variant}
                />
              );
            })}
          </EvilBarChart>
        </VisualCardBody>
        <VisualCardActions>
          <VisualCardFullscreen />
        </VisualCardActions>
        <VisualCardFooter>
          <ChartSeriesFacts />
        </VisualCardFooter>
      </VisualCard>
    </ChartDataProvider>
  );
}
