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
  { month: "august", garlic: 58, shallot: 48, chili: 54 },
  { month: "september", garlic: 61, shallot: 54, chili: 58 },
  { month: "october", garlic: 67, shallot: 60, chili: 62 },
  { month: "november", garlic: 76, shallot: 66, chili: 68 },
  { month: "december", garlic: 88, shallot: 72, chili: 72 },
] as const;

type ChartMonth = (typeof chartData)[number]["month"];

interface Props {
  description: ReactNode;
  monthLabels: Record<ChartMonth, string>;
  seriesLabels: {
    chili: ReactNode;
    garlic: ReactNode;
    shallot: ReactNode;
  };
  title: ReactNode;
  yAxisLabel: string;
}

/** Renders the spice sales chart with MDX-owned copy. */
export function SpiceSalesChart({
  description,
  monthLabels,
  seriesLabels,
  title,
  yAxisLabel,
}: Props) {
  const data = useMemo(
    () =>
      chartData.map((item) => ({
        ...item,
        month: monthLabels[item.month],
      })),
    [monthLabels]
  );

  const chartConfig = useMemo(
    () =>
      ({
        garlic: {
          label: seriesLabels.garlic,
          colors: { light: ["var(--chart-1)"] },
        },
        shallot: {
          label: seriesLabels.shallot,
          colors: { light: ["var(--chart-2)"] },
        },
        chili: {
          label: seriesLabels.chili,
          colors: { light: ["var(--chart-3)"] },
        },
      }) satisfies ChartConfig,
    [seriesLabels.chili, seriesLabels.garlic, seriesLabels.shallot]
  );

  return (
    <Card className="content-auto-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer className="aspect-video" config={chartConfig}>
          <ChartBarChart accessibilityLayer data={data}>
            <ChartCartesianGrid vertical={false} />
            <ChartXAxis
              axisLine={false}
              dataKey="month"
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
