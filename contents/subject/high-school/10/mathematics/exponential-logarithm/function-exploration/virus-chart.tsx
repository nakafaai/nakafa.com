"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
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
          <LineChart data={data} accessibilityLayer>
            <CartesianGrid />
            <XAxis
              dataKey="phase"
              tickMargin={8}
              tickFormatter={(value) => {
                return value.toString();
              }}
            />
            <YAxis
              label={{
                value: labels.yLabel,
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
                  // Extract the phase value from the first payload item
                  const phaseValue = payload[0].payload.phase;
                  return (
                    <ChartTooltipContent
                      active={active}
                      payload={payload}
                      label={`${labels.phase} ${phaseValue}`}
                    />
                  );
                }
                return null;
              }}
            />
            <Line
              type="monotone"
              dataKey="exponential"
              stroke={chartConfig.exponential.color}
              strokeWidth={2}
              dot
              name="exponential"
            />
            <Line
              type="monotone"
              dataKey="linear"
              stroke={chartConfig.linear.color}
              strokeWidth={2}
              dot
              name="linear"
            />
            <Line
              type="monotone"
              dataKey="logarithmic"
              stroke={chartConfig.logarithmic.color}
              strokeWidth={2}
              dot
              name="logarithmic"
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
