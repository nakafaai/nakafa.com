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
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@repo/design-system/components/ui/chart";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

type Props = {
  labels: {
    title?: string;
    description?: string;
    exponential?: string;
    linear?: string;
    logarithmic?: string;
    yLabel?: string;
    caption?: string;
    phase?: string;
  };
};

const data = Array.from({ length: 5 }, (_, i) => {
  const phase = i + 1;
  return {
    phase,
    exponential: 3 ** phase, // Exponential: 3^phase
    linear: 3 * phase, // Linear: 3*phase
    logarithmic: Math.log(phase + 1) * 20, // Logarithmic: log(phase+1) * scaling factor
  };
});

export function VirusChart({
  labels = {
    title: "Virus Spread",
    description: "Number of people infected in each phase of the virus spread.",
    exponential: "Exponential Function",
    linear: "Linear Function",
    logarithmic: "Logarithmic Function",
    yLabel: "Number of people infected",
    caption:
      "Virus spread grows exponentially, accelerating rapidly after initial phases.",
    phase: "Phase",
  },
}: Props) {
  const chartConfig = {
    exponential: {
      label: labels.exponential,
      color: "var(--chart-1)",
    },
    linear: {
      label: labels.linear,
      color: "var(--chart-2)",
    },
    logarithmic: {
      label: labels.logarithmic,
      color: "var(--chart-3)",
    },
  } satisfies ChartConfig;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{labels.title}</CardTitle>
        <CardDescription>{labels.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <LineChart accessibilityLayer data={data}>
            <CartesianGrid />
            <XAxis
              dataKey="phase"
              tickFormatter={(value) => {
                return value.toString();
              }}
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
                value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value
              }
              tickMargin={8}
            />
            <ChartTooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
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
            <Line
              dataKey="exponential"
              dot
              name="exponential"
              stroke={chartConfig.exponential.color}
              strokeWidth={2}
              type="monotone"
            />
            <Line
              dataKey="linear"
              dot
              name="linear"
              stroke={chartConfig.linear.color}
              strokeWidth={2}
              type="monotone"
            />
            <Line
              dataKey="logarithmic"
              dot
              name="logarithmic"
              stroke={chartConfig.logarithmic.color}
              strokeWidth={2}
              type="monotone"
            />
            <ChartLegend
              content={<ChartLegendContent verticalAlign="bottom" />}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <p className="text-foreground/80 text-sm">{labels.caption}</p>
      </CardFooter>
    </Card>
  );
}
