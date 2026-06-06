"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import {
  ChartCartesianGrid,
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartLine,
  ChartLineChart,
  ChartTooltip,
  ChartTooltipContent,
  ChartXAxis,
  ChartYAxis,
} from "@repo/design-system/components/ui/chart";
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
      colors: { light: ["var(--chart-1)"] },
    },
    linear: {
      label: labels.linear,
      colors: { light: ["var(--chart-2)"] },
    },
    logarithmic: {
      label: labels.logarithmic,
      colors: { light: ["var(--chart-3)"] },
    },
  } satisfies ChartConfig;

  return (
    <Card className="content-auto-card">
      <CardHeader>
        <CardTitle>{labels.title}</CardTitle>
        <CardDescription>{labels.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <ChartLineChart accessibilityLayer data={data}>
            <ChartCartesianGrid />
            <ChartXAxis
              dataKey="phase"
              tickFormatter={(value) => value.toString()}
              tickMargin={8}
            />
            <ChartYAxis
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
                  // Extract the phase value from the first payload item
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
            <ChartLine
              dataKey="exponential"
              dot
              name="exponential"
              stroke="var(--color-exponential-0)"
              strokeWidth={2}
              type="monotone"
            />
            <ChartLine
              dataKey="linear"
              dot
              name="linear"
              stroke="var(--color-linear-0)"
              strokeWidth={2}
              type="monotone"
            />
            <ChartLine
              dataKey="logarithmic"
              dot
              name="logarithmic"
              stroke="var(--color-logarithmic-0)"
              strokeWidth={2}
              type="monotone"
            />
            <ChartLegend
              content={<ChartLegendContent verticalAlign="bottom" />}
            />
          </ChartLineChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <p className="text-sm">{labels.caption}</p>
      </CardFooter>
    </Card>
  );
}
