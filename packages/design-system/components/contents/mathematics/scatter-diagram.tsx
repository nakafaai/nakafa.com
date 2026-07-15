"use client";

import {
  ActiveDot,
  Dot,
  EvilComposedChart,
  Grid,
  Legend,
  Line,
  ReferenceLine,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "@repo/design-system/components/evilcharts/charts/composed-chart";
import type { ChartConfig } from "@repo/design-system/components/evilcharts/ui/chart-config";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { getPointSeriesCue } from "@repo/design-system/lib/charts/series-cue";
import type { ReactNode } from "react";

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

const REGRESSION_DATA_KEY = "regression";
const DEFAULT_REGRESSION_COLOR = "var(--chart-5)";

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
  const datasetConfig = Object.fromEntries(
    datasets.map((dataset, index) => [
      dataset.name,
      {
        cue: getPointSeriesCue(index),
        label: dataset.name,
        colors: { light: [dataset.color], dark: [dataset.color] },
      },
    ])
  );
  const chartConfig = {
    x: { label: xAxisLabel || "X" },
    y: { label: yAxisLabel || "Y" },
    [REGRESSION_DATA_KEY]: {
      label: "Regresi",
      colors: {
        light: [regressionLineStyle?.color || DEFAULT_REGRESSION_COLOR],
        dark: [regressionLineStyle?.color || DEFAULT_REGRESSION_COLOR],
      },
    },
    ...datasetConfig,
  } satisfies ChartConfig;
  const chartData = datasets.flatMap((dataset) =>
    dataset.points.map((point) => ({
      x: point.x,
      y: point.y,
      [dataset.name]: point.y,
    }))
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
        <EvilComposedChart config={chartConfig} data={chartData}>
          <Grid vertical={false} />
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
          <Tooltip hideContent />
          {datasets.map((dataset, index) => {
            const cue = getPointSeriesCue(index);

            return (
              <Scatter
                data={dataset.points}
                dataKey={dataset.name}
                key={dataset.name}
              >
                <Dot variant={cue.dot} />
                <ActiveDot variant={cue.activeDot} />
              </Scatter>
            );
          })}
          {!!regressionLineData && !!calculateRegressionLine && (
            <Line
              dataKey={REGRESSION_DATA_KEY}
              lineProps={{
                activeDot: false,
                data: regressionLineData.map((point) => ({
                  x: point.x,
                  [REGRESSION_DATA_KEY]: point.y,
                })),
                dot: false,
                legendType: "none",
                strokeDasharray: regressionLineStyle?.strokeDasharray,
                strokeWidth: 2,
                tooltipType: "none",
              }}
            />
          )}
          {!!showResiduals &&
            !!regressionParams &&
            datasets.flatMap((dataset) =>
              dataset.points.map((point) => {
                const yPredicted =
                  regressionParams.m * point.x + regressionParams.b;

                return (
                  <ReferenceLine
                    ifOverflow="visible"
                    key={`${dataset.name}-residual-${point.x}-${point.y}-${yPredicted}`}
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
          <Legend variant="circle" />
        </EvilComposedChart>
      </CardContent>
    </Card>
  );
}

/** Calculates the least-squares line for one set of scatter points. */
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
