"use client";

import {
  ActiveDot,
  Dot,
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
import { getLineSeriesCue } from "@repo/design-system/lib/charts/series-cue";
import { type ReactNode, useMemo } from "react";

const chartData = [
  { month: "Januari", grainPrice: 5353, governmentPrice: 3700 },
  { month: "Februari", grainPrice: 5114, governmentPrice: 3700 },
  { month: "Maret", grainPrice: 4604, governmentPrice: 3700 },
  { month: "April", grainPrice: 4357, governmentPrice: 3700 },
] as const;

type ChartMonth = (typeof chartData)[number]["month"];

const SALES_CUES = {
  grainPrice: getLineSeriesCue(0),
  governmentPrice: getLineSeriesCue(1),
};

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
          cue: SALES_CUES.grainPrice,
          label: seriesLabels.grainPrice,
          colors: { light: ["var(--chart-1)"], dark: ["var(--chart-1)"] },
        },
        governmentPrice: {
          cue: SALES_CUES.governmentPrice,
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
            lineProps={{
              strokeDasharray: SALES_CUES.grainPrice.strokeDasharray,
              strokeWidth: 2,
            }}
          >
            <Dot variant={SALES_CUES.grainPrice.dot} />
            <ActiveDot variant={SALES_CUES.grainPrice.activeDot} />
          </Line>
          <Line
            curveType="monotone"
            dataKey="governmentPrice"
            lineProps={{
              strokeDasharray: SALES_CUES.governmentPrice.strokeDasharray,
              strokeWidth: 2,
            }}
          >
            <Dot variant={SALES_CUES.governmentPrice.dot} />
            <ActiveDot variant={SALES_CUES.governmentPrice.activeDot} />
          </Line>
        </EvilLineChart>
      </CardContent>
    </Card>
  );
}
