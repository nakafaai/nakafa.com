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
  ChartBar,
  ChartBarChart,
  ChartCartesianGrid,
  type ChartConfig,
  ChartContainer,
  ChartLabelList,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  ChartXAxis,
  ChartYAxis,
} from "@repo/design-system/components/ui/chart";
import type { ReactNode } from "react";

interface Props {
  description: ReactNode;
  footnote: ReactNode;
  labels: {
    electability: ReactNode;
    notAnswering: string;
  };
  title: ReactNode;
}

export function ElectabilityChart({
  title,
  description,
  footnote,
  labels,
}: Props) {
  const electabilityData = [
    {
      name: "Anies Baswedan",
      value: 40,
    },
    {
      name: "Basuki Tjahaja Purnama",
      value: 24,
    },
    {
      name: "Ridwan Kamil",
      value: 13,
    },
    {
      name: "Tri Rismaharini",
      value: 1,
    },
    {
      name: "Erick Tohir",
      value: 1,
    },
    {
      name: "Erwin Aksa",
      value: 1,
    },
    {
      name: "Ahmad Sahroni",
      value: 1,
    },
    {
      name: labels.notAnswering,
      value: 16,
    },
  ];

  const chartConfig = {
    value: {
      label: labels.electability,
      colors: { light: ["var(--chart-3)"] },
    },
    label: {
      colors: { light: ["var(--background)"] },
    },
  } satisfies ChartConfig;

  return (
    <Card className="content-auto-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <ChartBarChart
            accessibilityLayer
            data={electabilityData}
            layout="vertical"
            margin={{
              right: 24,
              left: 81,
            }}
          >
            <ChartCartesianGrid horizontal={false} />
            <ChartYAxis
              axisLine={false}
              dataKey="name"
              hide
              tickLine={false}
              tickMargin={10}
              type="category"
            />
            <ChartXAxis dataKey="value" hide type="number" />
            <ChartTooltip
              content={<ChartTooltipContent indicator="line" />}
              cursor={false}
            />
            <ChartBar dataKey="value" fill="var(--color-value-0)" radius={8}>
              <ChartLabelList
                className="fill-foreground"
                dataKey="name"
                fontSize={12}
                offset={10}
                position="left"
                width={75}
              />
              <ChartLabelList
                className="fill-foreground"
                dataKey="value"
                fontSize={12}
                offset={8}
                position="right"
              />
            </ChartBar>
            <ChartLegend content={<ChartLegendContent />} />
          </ChartBarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <p className="text-sm">{footnote}</p>
      </CardFooter>
    </Card>
  );
}
