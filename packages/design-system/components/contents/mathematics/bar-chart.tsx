"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import type { ChartConfig } from "@repo/design-system/components/ui/chart";
import {
  ChartBar,
  ChartBarChart,
  ChartCartesianGrid,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartXAxis,
  ChartYAxis,
} from "@repo/design-system/components/ui/chart";

interface Props {
  chartConfig: ChartConfig;
  data: {
    name: string;
    value: number;
  }[];
  description: string;
  title: string;
  yAxisLabel: string;
}

export function HistogramChart({
  title,
  description,
  data,
  chartConfig,
  yAxisLabel,
}: Props) {
  return (
    <Card className="content-auto-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer className="aspect-square" config={chartConfig}>
          <ChartBarChart
            accessibilityLayer
            barCategoryGap={0}
            barGap={0}
            data={data}
          >
            <ChartCartesianGrid vertical={false} />

            <ChartXAxis
              axisLine={false}
              dataKey="name"
              tickLine={false}
              tickMargin={10}
            />
            <ChartYAxis
              axisLine={false}
              dataKey="value"
              label={{
                value: yAxisLabel,
                angle: -90,
                position: "insideLeft",
                style: { textAnchor: "middle" },
              }}
              tickLine={false}
              tickMargin={10}
            />
            <ChartTooltip
              content={<ChartTooltipContent indicator="line" />}
              cursor={false}
            />
            <ChartBar dataKey="value" radius={0} />
          </ChartBarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export function BarChart({
  title,
  description,
  data,
  chartConfig,
  yAxisLabel,
}: Props) {
  return (
    <Card className="content-auto-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer className="aspect-square" config={chartConfig}>
          <ChartBarChart accessibilityLayer data={data}>
            <ChartCartesianGrid vertical={false} />
            <ChartXAxis
              axisLine={false}
              dataKey="name"
              tickLine={false}
              tickMargin={10}
            />
            <ChartYAxis
              axisLine={false}
              dataKey="value"
              label={{
                value: yAxisLabel,
                angle: -90,
                position: "insideLeft",
                style: { textAnchor: "middle" },
              }}
              tickLine={false}
              tickMargin={10}
            />
            <ChartTooltip
              content={<ChartTooltipContent indicator="line" />}
              cursor={false}
            />
            <ChartBar dataKey="value" radius={8} />
          </ChartBarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
