"use client";

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
  { month: "Jan-19", A: 27, B: 19.7, C: 11.8, D: 20.7 },
  { month: "Feb-19", A: 31.8, B: 23.2, C: 14.9, D: 10.8 },
  { month: "Mar-19", A: 26.9, B: 21.5, C: 17, D: 16.8 },
];

interface Props {
  description: ReactNode;
  seriesLabels: {
    A: ReactNode;
    B: ReactNode;
    C: ReactNode;
    D: ReactNode;
  };
  title: ReactNode;
  yAxisLabel: string;
}

/** Renders the smartphone company user chart with MDX-owned copy. */
export function SalesChart({
  description,
  seriesLabels,
  title,
  yAxisLabel,
}: Props) {
  const chartConfig = useMemo(
    () =>
      ({
        A: {
          cue: getBarSeriesCue(0),
          label: seriesLabels.A,
          colors: { light: ["var(--chart-1)"], dark: ["var(--chart-1)"] },
        },
        B: {
          cue: getBarSeriesCue(1),
          label: seriesLabels.B,
          colors: { light: ["var(--chart-2)"], dark: ["var(--chart-2)"] },
        },
        C: {
          cue: getBarSeriesCue(2),
          label: seriesLabels.C,
          colors: { light: ["var(--chart-3)"], dark: ["var(--chart-3)"] },
        },
        D: {
          cue: getBarSeriesCue(3),
          label: seriesLabels.D,
          colors: { light: ["var(--chart-4)"], dark: ["var(--chart-4)"] },
        },
      }) satisfies ChartConfig,
    [seriesLabels.A, seriesLabels.B, seriesLabels.C, seriesLabels.D]
  );

  const chartSummary = useMemo(
    () => ({
      categories: Arr.map(chartData, (row) => row.month),
      series: [
        {
          key: "A",
          label: chartConfig.A.label,
          color: chartConfig.A.colors.light[0],
          values: Arr.map(chartData, (row) => row.A),
        },
        {
          key: "B",
          label: chartConfig.B.label,
          color: chartConfig.B.colors.light[0],
          values: Arr.map(chartData, (row) => row.B),
        },
        {
          key: "C",
          label: chartConfig.C.label,
          color: chartConfig.C.colors.light[0],
          values: Arr.map(chartData, (row) => row.C),
        },
        {
          key: "D",
          label: chartConfig.D.label,
          color: chartConfig.D.colors.light[0],
          values: Arr.map(chartData, (row) => row.D),
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
              dataKey="month"
              tickLine={false}
              tickMargin={10}
            />
            <YAxis
              axisLine={false}
              label={{
                value: yAxisLabel,
                angle: -90,
                position: "insideLeft",
                offset: 10,
                style: { textAnchor: "middle" },
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
