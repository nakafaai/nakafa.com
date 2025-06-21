"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

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
import { useMemo } from "react";
import type { ReactNode } from "react";

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
          <LineChart data={data} accessibilityLayer>
            <CartesianGrid />
            <XAxis
              dataKey="x"
              tickMargin={8}
              tickFormatter={(value) => {
                return value.toString();
              }}
            />
            <YAxis
              label={{
                value: "f(x)",
                angle: -90,
                position: "insideLeft",
                style: { textAnchor: "middle" },
              }}
              tickMargin={8}
              tickFormatter={(value) =>
                value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value
              }
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
                        payload={[]}
                        label={`x = ${xValue}, y = undefined`}
                      />
                    );
                  }

                  return (
                    <ChartTooltipContent
                      active={active}
                      payload={payload}
                      label={`x = ${xValue}`}
                    />
                  );
                }
                return null;
              }}
            />
            <Line
              type="monotone"
              dataKey="y"
              stroke={chartConfig.y.color}
              strokeWidth={2}
              dot
              name="y"
              connectNulls={false}
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
