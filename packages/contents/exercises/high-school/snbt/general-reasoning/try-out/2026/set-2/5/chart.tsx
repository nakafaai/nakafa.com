"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import {
  ChartBar,
  ChartBarChart,
  ChartCartesianGrid,
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  ChartXAxis,
  ChartYAxis,
} from "@repo/design-system/components/ui/chart";
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
          label: seriesLabels.shirts,
          colors: { light: ["var(--chart-1)"] },
        },
        pants: {
          label: seriesLabels.pants,
          colors: { light: ["var(--chart-2)"] },
        },
        suits: {
          label: seriesLabels.suits,
          colors: { light: ["var(--chart-3)"] },
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
        <ChartContainer className="aspect-video" config={chartConfig}>
          <ChartBarChart accessibilityLayer data={chartData}>
            <ChartCartesianGrid vertical={false} />
            <ChartXAxis
              axisLine={false}
              dataKey="year"
              tickLine={false}
              tickMargin={10}
            />
            <ChartYAxis
              axisLine={false}
              label={{
                value: yAxisLabel,
                angle: -90,
                position: "insideLeft",
              }}
              tickLine={false}
              tickMargin={10}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            {Object.keys(chartConfig).map((key) => (
              <ChartBar
                dataKey={key}
                fill={`var(--color-${key}-0)`}
                key={key}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </ChartBarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
