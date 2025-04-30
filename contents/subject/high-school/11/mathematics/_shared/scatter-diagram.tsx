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
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { ReactNode } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  Scatter,
  XAxis,
  YAxis,
} from "recharts";

type Point = { x: number; y: number };

type Dataset = {
  name: string;
  color: string;
  points: Point[];
};

type RegressionLineStyle = {
  color?: string;
  strokeDasharray?: string;
};

type Props = {
  title: ReactNode;
  description: ReactNode;
  xAxisLabel?: string;
  yAxisLabel?: string;
  xAxisDomain?: "min-max";
  datasets: Dataset[];
  calculateRegressionLine?: boolean;
  regressionLineStyle?: RegressionLineStyle;
  showResiduals?: boolean;
};

export function ScatterDiagram({
  title,
  description,
  xAxisLabel,
  yAxisLabel,
  xAxisDomain,
  datasets,
  calculateRegressionLine,
  regressionLineStyle,
  showResiduals,
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

  let regressionLineData: { x: number; y: number }[] | undefined;
  let regressionParams: { m: number; b: number } | null = null;

  if (calculateRegressionLine) {
    const allPoints = datasets.flatMap((d) => d.points);
    regressionParams = calculateLeastSquares(allPoints);

    if (regressionParams && allPoints.length > 0) {
      const xValues = allPoints.map((p) => p.x);
      const xMin = Math.min(...xValues);
      const xMax = Math.max(...xValues);
      const { m, b } = regressionParams;
      regressionLineData = [
        { x: xMin, y: m * xMin + b },
        { x: xMax, y: m * xMax + b },
      ];
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <ComposedChart accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="x"
              type="number"
              domain={
                xAxisDomain === "min-max" ? ["dataMin", "dataMax"] : undefined
              }
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
            <ChartTooltip content={<ChartTooltipContent hideLabel={true} />} />
            {datasets.map((dataset) => (
              <Scatter
                key={dataset.name}
                data={dataset.points}
                name={dataset.name}
                fill={dataset.color}
              />
            ))}
            {regressionLineData && calculateRegressionLine && (
              <Line
                data={regressionLineData}
                dataKey="y"
                type="linear"
                stroke={regressionLineStyle?.color || "var(--chart-5)"}
                strokeWidth={2}
                strokeDasharray={regressionLineStyle?.strokeDasharray}
                dot={false}
                activeDot={false}
              />
            )}
            {showResiduals &&
              regressionParams &&
              datasets.flatMap((dataset) =>
                dataset.points.map((point, index) => {
                  const yPredicted =
                    regressionParams.m * point.x + regressionParams.b;
                  return (
                    <ReferenceLine
                      key={`${dataset.name}-residual-${index}`}
                      segment={[
                        { x: point.x, y: point.y },
                        { x: point.x, y: yPredicted },
                      ]}
                      stroke={dataset.color}
                      strokeDasharray="2 2"
                      ifOverflow="visible"
                    />
                  );
                })
              )}
            <ChartLegend content={<ChartLegendContent className="mt-6" />} />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function calculateLeastSquares(
  points: Point[]
): { m: number; b: number } | null {
  const n = points.length;
  if (n < 2) {
    return null;
  }

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumX2 += p.x * p.x;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) {
    return null;
  }

  const m = (n * sumXY - sumX * sumY) / denominator;
  const b = (sumY - m * sumX) / n;

  return { m, b };
}
