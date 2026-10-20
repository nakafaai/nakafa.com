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
import { Array as Arr, Record as Rec } from "effect";
import { type ReactNode, useMemo } from "react";

const chartData = [
  { year: "2017", mieA: 3500, mieB: 4500, mieC: 2250 },
  { year: "2018", mieA: 2500, mieB: 4250, mieC: 2500 },
  { year: "2019", mieA: 3350, mieB: 4000, mieC: 2800 },
  { year: "2020", mieA: 3000, mieB: 4500, mieC: 2650 },
];

interface Props {
  description: ReactNode;
  seriesLabels: {
    mieA: string;
    mieB: string;
    mieC: string;
  };
  title: ReactNode;
  yAxisLabel: string;
}

/** Renders the instant noodle price chart with MDX-owned copy. */
export function PriceChart({
  description,
  seriesLabels,
  title,
  yAxisLabel,
}: Props) {
  const chartConfig = useMemo(
    () =>
      ({
        mieA: {
          cue: getBarSeriesCue(0),
          label: seriesLabels.mieA,
          colors: { light: ["var(--chart-1)"], dark: ["var(--chart-1)"] },
        },
        mieB: {
          cue: getBarSeriesCue(1),
          label: seriesLabels.mieB,
          colors: { light: ["var(--chart-2)"], dark: ["var(--chart-2)"] },
        },
        mieC: {
          cue: getBarSeriesCue(2),
          label: seriesLabels.mieC,
          colors: { light: ["var(--chart-3)"], dark: ["var(--chart-3)"] },
        },
      }) satisfies ChartConfig,
    [seriesLabels.mieA, seriesLabels.mieB, seriesLabels.mieC]
  );

  const chartSummary = useMemo(
    () => ({
      categories: Arr.map(chartData, (row) => row.year),
      series: [
        {
          key: "mieA",
          label: chartConfig.mieA.label,
          color: chartConfig.mieA.colors.light[0],
          values: Arr.map(chartData, (row) => row.mieA),
        },
        {
          key: "mieB",
          label: chartConfig.mieB.label,
          color: chartConfig.mieB.colors.light[0],
          values: Arr.map(chartData, (row) => row.mieB),
        },
        {
          key: "mieC",
          label: chartConfig.mieC.label,
          color: chartConfig.mieC.colors.light[0],
          values: Arr.map(chartData, (row) => row.mieC),
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
              tickFormatter={(value) => `${value / 1000}k`}
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
