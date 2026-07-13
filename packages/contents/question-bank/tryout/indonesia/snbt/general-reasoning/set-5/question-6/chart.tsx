"use client";

import {
  Bar,
  EvilBarChart,
  Grid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from "@repo/design-system/components/evilcharts/charts/bar-chart";
import type { ChartConfig } from "@repo/design-system/components/evilcharts/ui/chart-config";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { getBarSeriesCue } from "@repo/design-system/lib/chart-series-cue";
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

  return (
    <Card className="content-auto-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
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
          {Object.keys(chartConfig).map((key, index) => {
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
      </CardContent>
    </Card>
  );
}
