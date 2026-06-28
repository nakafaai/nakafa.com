"use client";

import {
  EvilLineChart,
  Grid,
  Legend,
  Line,
  XAxis,
  YAxis,
} from "@repo/design-system/components/evilcharts/charts/line-chart";
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
import type { ReactNode } from "react";
import { useMemo } from "react";

const THRESHOLD_VALUE = 1000;
const THRESHOLD_VALUE_DECIMAL_PLACES = 0;
const FUNCTION_CHART_CONFIG = {
  y: {
    label: "f(x)",
    colors: { light: ["var(--chart-1)"], dark: ["var(--chart-1)"] },
  },
} satisfies ChartConfig;

interface Props {
  a: number;
  description: ReactNode;
  n?: number;
  p: number;
  title: ReactNode;
}

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

  return (
    <Card className="content-auto-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <EvilLineChart
          config={FUNCTION_CHART_CONFIG}
          curveType="monotone"
          data={data}
        >
          <Grid />
          <XAxis
            dataKey="x"
            tickFormatter={(value) => value.toString()}
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
              value >= THRESHOLD_VALUE
                ? `${(value / THRESHOLD_VALUE).toFixed(THRESHOLD_VALUE_DECIMAL_PLACES)}k`
                : String(value)
            }
            tickMargin={8}
          />
          <ChartTooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length > 0) {
                const xValue = payload[0].payload.x;
                const yValue = payload[0].payload.y;

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
            lineProps={{ dot: true, name: "y", strokeWidth: 2 }}
          />
          <Legend verticalAlign="bottom" />
        </EvilLineChart>
      </CardContent>
    </Card>
  );
}
