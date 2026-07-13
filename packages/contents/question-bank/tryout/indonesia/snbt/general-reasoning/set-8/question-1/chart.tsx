"use client";

import {
  Bar,
  EvilBarChart,
  Grid,
  Legend,
  XAxis,
  YAxis,
} from "@repo/design-system/components/evilcharts/charts/bar-chart";
import type { ChartConfig } from "@repo/design-system/components/evilcharts/ui/chart-config";
import {
  ChartTooltip,
  ChartTooltipContent,
} from "@repo/design-system/components/evilcharts/ui/tooltip";
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
  { year: "1", A: 260, B: 250, C: 225 },
  { year: "2", A: 390, B: 275, C: 280 },
  { year: "3", A: 425, B: 350, C: 320 },
  { year: "4", A: 450, B: 385, C: 400 },
  { year: "5", A: 520, B: 450, C: 495 },
];

interface Props {
  description: ReactNode;
  seriesLabels: {
    A: ReactNode;
    B: ReactNode;
    C: ReactNode;
  };
  title: ReactNode;
  yAxisLabel: string;
  yearLabel: string;
}

/** Renders the flower shop sales chart with MDX-owned copy. */
export function SalesChart({
  description,
  seriesLabels,
  title,
  yAxisLabel,
  yearLabel,
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
      }) satisfies ChartConfig,
    [seriesLabels.A, seriesLabels.B, seriesLabels.C]
  );

  const formatYear = (value: string) => `${yearLabel}${value}`;

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
          <XAxis dataKey="year" tickFormatter={formatYear} tickMargin={10} />
          <YAxis
            label={{
              value: yAxisLabel,
              angle: -90,
              position: "insideLeft",
              offset: 10,
              style: { textAnchor: "middle" },
            }}
            tickMargin={10}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(value) => formatYear(String(value))}
              />
            }
          />
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
