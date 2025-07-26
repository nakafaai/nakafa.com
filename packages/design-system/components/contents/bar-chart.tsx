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
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@repo/design-system/components/ui/chart";
import {
  CartesianGrid,
  Bar as RechartsBar,
  BarChart as RechartsBarChart,
  XAxis,
  YAxis,
} from "recharts";

type Props = {
  title: string;
  description: string;
  data: {
    name: string;
    value: number;
  }[];
  chartConfig: ChartConfig;
  yAxisLabel: string;
};

export function HistogramChart({
  title,
  description,
  data,
  chartConfig,
  yAxisLabel,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer className="aspect-square" config={chartConfig}>
          <RechartsBarChart
            accessibilityLayer
            barCategoryGap={0}
            barGap={0}
            data={data}
          >
            <CartesianGrid vertical={false} />

            <XAxis
              axisLine={false}
              dataKey="name"
              tickLine={false}
              tickMargin={10}
            />
            <YAxis
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
            <RechartsBar dataKey="value" radius={0} />
          </RechartsBarChart>
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
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer className="aspect-square" config={chartConfig}>
          <RechartsBarChart accessibilityLayer data={data}>
            <CartesianGrid vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="name"
              tickLine={false}
              tickMargin={10}
            />
            <YAxis
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
            <RechartsBar dataKey="value" radius={8} />
          </RechartsBarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
