"use client";

import {
  Card,
  CardContent,
  CardDescription,
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
              domain={xAxisDomain === "min-max" ? ["dataMin", "dataMax"] : null}
              label={{
                value: xAxisLabel || "X",
                position: "bottom",
                offset: 10,
                style: { textAnchor: "middle" },
              }}
              tickFormatter={(value) => value.toString()}
              tickMargin={8}
              type="number"
            />
            <YAxis
              dataKey="y"
              label={{
                value: yAxisLabel || "Y",
                angle: -90,
                position: "insideLeft",
                style: { textAnchor: "middle" },
              }}
              tickMargin={8}
              type="number"
            />
            <ChartTooltip content={<ChartTooltipContent hideLabel={true} />} />
            {datasets.map((dataset) => (
              <Scatter
                data={dataset.points}
                fill={dataset.color}
                key={dataset.name}
                name={dataset.name}
              />
            ))}
            {!!regressionLineData && !!calculateRegressionLine && (
              <Line
                activeDot={false}
                data={regressionLineData}
                dataKey="y"
                dot={false}
                stroke={regressionLineStyle?.color || "var(--chart-5)"}
                strokeDasharray={regressionLineStyle?.strokeDasharray}
                strokeWidth={2}
                type="linear"
              />
            )}
            {!!showResiduals &&
              !!regressionParams &&
              datasets.flatMap((dataset) =>
                dataset.points.map((point, index) => {
                  const yPredicted =
                    regressionParams.m * point.x + regressionParams.b;
                  return (
                    <ReferenceLine
                      ifOverflow="visible"
                      key={`${dataset.name}-residual-${index}`}
                      segment={[
                        { x: point.x, y: point.y },
                        { x: point.x, y: yPredicted },
                      ]}
                      stroke={dataset.color}
                      strokeDasharray="2 2"
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
  let sumXy = 0;
  let sumX2 = 0;

  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXy += p.x * p.y;
    sumX2 += p.x * p.x;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) {
    return null;
  }

  const m = (n * sumXy - sumX * sumY) / denominator;
  const b = (sumY - m * sumX) / n;

  return { m, b };
}
