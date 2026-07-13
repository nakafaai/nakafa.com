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
  { year: "2011", shirts: 50, pants: 60, suits: 40 },
  { year: "2012", shirts: 35, pants: 60, suits: 55 },
  { year: "2013", shirts: 20, pants: 50, suits: 45 },
  { year: "2014", shirts: 70, pants: 40, suits: 60 },
  { year: "2015", shirts: 55, pants: 40, suits: 50 },
];

interface Props {
  description: ReactNode;
  seriesLabels: {
    pants: ReactNode;
    shirts: ReactNode;
    suits: ReactNode;
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
          colors: { light: ["var(--chart-1)"], dark: ["var(--chart-1)"] },
        },
        pants: {
          cue: getBarSeriesCue(1),
          label: seriesLabels.pants,
          colors: { light: ["var(--chart-2)"], dark: ["var(--chart-2)"] },
        },
        suits: {
          cue: getBarSeriesCue(2),
          label: seriesLabels.suits,
          colors: { light: ["var(--chart-3)"], dark: ["var(--chart-3)"] },
        },
      }) satisfies ChartConfig,
    [seriesLabels.pants, seriesLabels.shirts, seriesLabels.suits]
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
