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
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@repo/design-system/components/ui/chart";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

type Props = {
  p: number;
  a: number;
  title: ReactNode;
  description: ReactNode;
  n?: number;
};

export function FunctionChart({ p, a, title, description, n = 11 }: Props) {
  const data = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => {
        // Handle the specific case where a=0 and x=0 (mathematically undefined)
        if (a === 0 && i === 0) {
          return { x: i, y: null }; // Use null to represent undefined
        }
        return {
          x: i,
          y: p * a ** i,
        };
      }),
    [a, p, n]
  );

  const chartConfig = {
    y: {
      label: "f(x)",
      color: "var(--chart-1)",
    },
  } satisfies ChartConfig;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <LineChart accessibilityLayer data={data}>
            <CartesianGrid />
            <XAxis
              dataKey="x"
              tickFormatter={(value) => {
                return value.toString();
              }}
              tickMargin={8}
            />
            <YAxis
              label={{
                value: "f(x)",
                angle: -90,
                position: "insideLeft",
                style: { textAnchor: "middle" },
              }}
              tickFormatter={(value) =>
                value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value
              }
              tickMargin={8}
            />
            <ChartTooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const xValue = payload[0].payload.x;
                  const yValue = payload[0].payload.y;

                  // Special handling for undefined case
                  if (yValue === null) {
                    return (
                      <ChartTooltipContent
                        active={active}
                        label={`x = ${xValue}, y = undefined`}
                        payload={[]}
                      />
                    );
                  }

                  return (
                    <ChartTooltipContent
                      active={active}
                      label={`x = ${xValue}`}
                      payload={payload}
                    />
                  );
                }
                return null;
              }}
            />
            <Line
              connectNulls={false}
              dataKey="y"
              dot
              name="y"
              stroke={chartConfig.y.color}
              strokeWidth={2}
              type="monotone"
            />
            <ChartLegend
              content={<ChartLegendContent verticalAlign="bottom" />}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
