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
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import type { ReactNode } from "react";

const EXPONENTIAL_BASE = 3;
const LINEAR_SCALING_FACTOR = 3;
const LOGARITHMIC_SCALING_FACTOR = 20;
const THRESHOLD_VALUE = 1000;
const THRESHOLD_VALUE_DECIMAL_PLACES = 0;

interface Props {
  labels: {
    title: ReactNode;
    description: ReactNode;
    exponential: ReactNode;
    linear: ReactNode;
    logarithmic: ReactNode;
    yLabel: string;
    caption: ReactNode;
    phase: string;
  };
}

const data = Array.from({ length: 5 }, (_, i) => {
  const phase = i + 1;
  return {
    phase,
    exponential: EXPONENTIAL_BASE ** phase, // Exponential: 3^phase
    linear: LINEAR_SCALING_FACTOR * phase, // Linear: 3*phase
    logarithmic: Math.log(phase + 1) * LOGARITHMIC_SCALING_FACTOR, // Logarithmic: log(phase+1) * scaling factor
  };
});

export function VirusChart({ labels }: Props) {
  const chartConfig = {
    exponential: {
      label: labels.exponential,
      colors: { light: ["var(--chart-1)"], dark: ["var(--chart-1)"] },
    },
    linear: {
      label: labels.linear,
      colors: { light: ["var(--chart-2)"], dark: ["var(--chart-2)"] },
    },
    logarithmic: {
      label: labels.logarithmic,
      colors: { light: ["var(--chart-3)"], dark: ["var(--chart-3)"] },
    },
  } satisfies ChartConfig;

  return (
    <Card className="content-auto-card">
      <CardHeader>
        <CardTitle>{labels.title}</CardTitle>
        <CardDescription>{labels.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <EvilLineChart config={chartConfig} curveType="monotone" data={data}>
          <Grid />
          <XAxis
            dataKey="phase"
            tickFormatter={(value) => value.toString()}
            tickMargin={8}
          />
          <YAxis
            label={{
              value: labels.yLabel,
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
                const phaseValue = payload[0].payload.phase;
                return (
                  <ChartTooltipContent
                    active={active}
                    label={`${labels.phase} ${phaseValue}`}
                    payload={payload}
                  />
                );
              }
              return null;
            }}
          />
          <Line
            dataKey="exponential"
            lineProps={{ dot: true, name: "exponential", strokeWidth: 2 }}
          />
          <Line
            dataKey="linear"
            lineProps={{ dot: true, name: "linear", strokeWidth: 2 }}
          />
          <Line
            dataKey="logarithmic"
            lineProps={{ dot: true, name: "logarithmic", strokeWidth: 2 }}
          />
          <Legend verticalAlign="bottom" />
        </EvilLineChart>
      </CardContent>
      <CardFooter>
        <p className="text-sm">{labels.caption}</p>
      </CardFooter>
    </Card>
  );
}
