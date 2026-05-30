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
} from "@repo/design-system/components/ui/chart";
import type { ReactNode } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  Scatter,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";

interface Point {
  x: number;
  y: number;
}

interface Dataset {
  color: string;
  name: string;
  points: Point[];
}

interface RegressionLineStyle {
  color?: string;
  strokeDasharray?: string;
}

interface Props {
  calculateRegressionLine?: boolean;
  datasets: Dataset[];
  description: ReactNode;
  regressionLineStyle?: RegressionLineStyle;
  showResiduals?: boolean;
  title: ReactNode;
  xAxisDomain?: "min-max";
  xAxisLabel?: string;
  yAxisLabel?: string;
}

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
        colors: { light: [dataset.color] },
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
    <Card className="content-auto-card">
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
              domain={
                xAxisDomain === "min-max" ? ["dataMin", "dataMax"] : undefined
              }
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
            <ChartTooltip
              content={
                <ScatterTooltipContent
                  xAxisLabel={xAxisLabel || "X"}
                  yAxisLabel={yAxisLabel || "Y"}
                />
              }
            />
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
                      // biome-ignore lint/suspicious/noArrayIndexKey: Points with same coordinates need index for uniqueness
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

/** Renders one scatter point as a coordinate pair instead of generic series rows. */
function ScatterTooltipContent({
  active,
  payload,
  xAxisLabel,
  yAxisLabel,
}: Partial<TooltipContentProps> & {
  xAxisLabel: string;
  yAxisLabel: string;
}) {
  if (!(active && payload?.length)) {
    return null;
  }

  const point = payload[0]?.payload;
  const x = getNumberProperty(point, "x");
  const y = getNumberProperty(point, "y");

  if (x === undefined || y === undefined) {
    return null;
  }

  return (
    <div className="grid min-w-40 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <TooltipRow label={xAxisLabel} value={x} />
      <TooltipRow label={yAxisLabel} value={y} />
    </div>
  );
}

/** Renders one value row inside the scatter tooltip. */
function TooltipRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium font-mono text-foreground tabular-nums">
        {value.toLocaleString()}
      </span>
    </div>
  );
}

/** Safely reads numeric coordinates from a Recharts tooltip payload. */
function getNumberProperty(value: unknown, key: string) {
  if (typeof value !== "object" || value === null) {
    return;
  }

  const property = Reflect.get(value, key);

  if (typeof property !== "number") {
    return;
  }

  return property;
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
