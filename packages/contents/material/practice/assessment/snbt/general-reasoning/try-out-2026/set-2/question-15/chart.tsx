"use client";

import {
  EvilLineChart,
  Grid,
  Legend,
  Line,
  Tooltip,
  XAxis,
  YAxis,
} from "@repo/design-system/components/evilcharts/charts/line-chart";
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
  { month: "Januari", grainPrice: 5353, governmentPrice: 3700 },
  { month: "Februari", grainPrice: 5114, governmentPrice: 3700 },
  { month: "Maret", grainPrice: 4604, governmentPrice: 3700 },
  { month: "April", grainPrice: 4357, governmentPrice: 3700 },
] as const;

type ChartMonth = (typeof chartData)[number]["month"];

interface Props {
  description: ReactNode;
  monthLabels: Record<ChartMonth, string>;
  seriesLabels: {
    governmentPrice: ReactNode;
    grainPrice: ReactNode;
  };
  title: ReactNode;
  yAxisLabel: string;
}

/** Renders the grain price chart with MDX-owned copy. */
export function SalesChart({
  description,
  monthLabels,
  seriesLabels,
  title,
  yAxisLabel,
}: Props) {
  const chartConfig = useMemo(
    () =>
      ({
        grainPrice: {
          label: seriesLabels.grainPrice,
          colors: { light: ["var(--chart-1)"], dark: ["var(--chart-1)"] },
        },
        governmentPrice: {
          label: seriesLabels.governmentPrice,
          colors: { light: ["var(--chart-2)"], dark: ["var(--chart-2)"] },
        },
      }) satisfies ChartConfig,
    [seriesLabels.governmentPrice, seriesLabels.grainPrice]
  );

  const translatedData = useMemo(
    () =>
      chartData.map((item) => ({
        ...item,
        month: monthLabels[item.month],
      })),
    [monthLabels]
  );

  return (
    <Card className="content-auto-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <EvilLineChart
          className="aspect-video"
          config={chartConfig}
          data={translatedData}
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
            domain={[3000, 6000]}
            label={{
              value: yAxisLabel,
              angle: -90,
              position: "insideLeft",
              offset: 0,
            }}
            tickFormatter={(value) => `${value / 1000}k`}
            tickLine={false}
            tickMargin={10}
          />
          <Tooltip />
          <Legend />
          <Line
            curveType="monotone"
            dataKey="grainPrice"
            lineProps={{ dot: { r: 4 }, strokeWidth: 2 }}
          />
          <Line
            curveType="monotone"
            dataKey="governmentPrice"
            lineProps={{ dot: { r: 4 }, strokeWidth: 2 }}
          />
        </EvilLineChart>
      </CardContent>
    </Card>
  );
}
