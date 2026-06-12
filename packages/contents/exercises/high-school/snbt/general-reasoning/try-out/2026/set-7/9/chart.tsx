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
  { day: "monday", library: 150, laboratory: 250 },
  { day: "tuesday", library: 135, laboratory: 210 },
  { day: "wednesday", library: 100, laboratory: 140 },
  { day: "thursday", library: 140, laboratory: 170 },
  { day: "friday", library: 165, laboratory: 120 },
] as const;

type ChartDay = (typeof chartData)[number]["day"];

interface Props {
  dayLabels: Record<ChartDay, string>;
  description: ReactNode;
  seriesLabels: {
    laboratory: ReactNode;
    library: ReactNode;
  };
  title: ReactNode;
  yAxisLabel: string;
}

/** Renders the school facility visitor chart with MDX-owned copy. */
export function VisitorChart({
  dayLabels,
  description,
  seriesLabels,
  title,
  yAxisLabel,
}: Props) {
  const data = useMemo(
    () =>
      chartData.map((item) => ({
        ...item,
        day: dayLabels[item.day],
      })),
    [dayLabels]
  );

  const chartConfig = useMemo(
    () =>
      ({
        library: {
          label: seriesLabels.library,
          colors: { light: ["var(--chart-1)"], dark: ["var(--chart-1)"] },
        },
        laboratory: {
          label: seriesLabels.laboratory,
          colors: { light: ["var(--chart-2)"], dark: ["var(--chart-2)"] },
        },
      }) satisfies ChartConfig,
    [seriesLabels.laboratory, seriesLabels.library]
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
          data={data}
        >
          <Grid vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="day"
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
          <Line
            dataKey="library"
            lineProps={{ dot: { r: 4 }, strokeWidth: 2 }}
          />
          <Line
            dataKey="laboratory"
            lineProps={{ dot: { r: 4 }, strokeWidth: 2 }}
          />
        </EvilLineChart>
      </CardContent>
    </Card>
  );
}
