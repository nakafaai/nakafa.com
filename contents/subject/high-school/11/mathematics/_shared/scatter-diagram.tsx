"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import type { ReactNode } from "react";
import { CartesianGrid, Scatter, ScatterChart, XAxis, YAxis } from "recharts";

type Dataset = {
  name: string;
  color: string;
  points: { x: number; y: number }[];
};

type Props = {
  title: ReactNode;
  description: ReactNode;
  xAxisLabel?: string;
  yAxisLabel?: string;
  datasets: Dataset[];
};

export function ScatterDiagram({
  title,
  description,
  xAxisLabel,
  yAxisLabel,
  datasets,
}: Props) {
  const chartConfig = datasets.reduce<ChartConfig>(
    (acc, dataset) => {
      acc[dataset.name] = {
        label: dataset.name,
        color: dataset.color,
      };
      return acc;
    },
    {
      x: { label: xAxisLabel || "X" },
      y: { label: yAxisLabel || "Y" },
    }
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <ScatterChart accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="x"
              tickMargin={8}
              tickFormatter={(value) => {
                return value.toString();
              }}
              label={{
                value: xAxisLabel || "X",
                position: "bottom",
                offset: 10,
                style: { textAnchor: "middle" },
              }}
            />
            <YAxis
              dataKey="y"
              type="number"
              tickMargin={8}
              label={{
                value: yAxisLabel || "Y",
                angle: -90,
                position: "insideLeft",
                style: { textAnchor: "middle" },
              }}
            />
            {datasets.map((dataset) => (
              <Scatter
                key={dataset.name}
                data={dataset.points}
                name={dataset.name}
                fill={dataset.color}
              />
            ))}
            <ChartLegend content={<ChartLegendContent className="mt-6" />} />
          </ScatterChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
