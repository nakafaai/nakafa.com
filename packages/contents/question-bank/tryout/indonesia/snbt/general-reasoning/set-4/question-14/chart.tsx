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
    mieA: ReactNode;
    mieB: ReactNode;
    mieC: ReactNode;
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
          label: seriesLabels.mieA,
          colors: { light: ["var(--chart-1)"], dark: ["var(--chart-1)"] },
        },
        mieB: {
          label: seriesLabels.mieB,
          colors: { light: ["var(--chart-2)"], dark: ["var(--chart-2)"] },
        },
        mieC: {
          label: seriesLabels.mieC,
          colors: { light: ["var(--chart-3)"], dark: ["var(--chart-3)"] },
        },
      }) satisfies ChartConfig,
    [seriesLabels.mieA, seriesLabels.mieB, seriesLabels.mieC]
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
            tickFormatter={(value) => `${value / 1000}k`}
            tickLine={false}
            tickMargin={10}
          />
          <Tooltip />
          <Legend />
          {Object.keys(chartConfig).map((key) => (
            <Bar dataKey={key} key={key} radius={4} />
          ))}
        </EvilBarChart>
      </CardContent>
    </Card>
  );
}
