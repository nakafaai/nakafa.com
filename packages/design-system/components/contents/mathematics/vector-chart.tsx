"use client";

import { VectorChartTooltip } from "@repo/design-system/components/contents/mathematics/vector-chart-tooltip";
import {
  ActiveDot,
  Dot,
  EvilLineChart,
  Grid,
  Legend,
  Line,
  XAxis,
  YAxis,
} from "@repo/design-system/components/evilcharts/charts/line-chart";
import type { ChartConfig } from "@repo/design-system/components/evilcharts/ui/chart-config";
import { ChartTooltip } from "@repo/design-system/components/evilcharts/ui/tooltip";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { getLineSeriesCue } from "@repo/design-system/lib/chart-series-cue";
import { Fragment, type ReactNode, useMemo } from "react";

interface Vector {
  color?: string;
  direction?: "forward" | "backward" | "both" | "none";
  id: string;
  name: string;
  points: {
    x: number;
    y: number;
  }[];
  type?: "monotone" | "step" | "linear";
}

interface Props {
  description: ReactNode;
  labels?: {
    xAxis: string;
    yAxis: string;
  };
  title: ReactNode;
  vectors: Vector[];
}

/** Renders one or more directed vectors with named, non-color series cues. */
export function VectorChart({
  title,
  description,
  vectors,
  labels = { xAxis: "x", yAxis: "y" },
}: Props) {
  const coloredVectors = useMemo(
    () =>
      vectors.map((vector, index) => ({
        ...vector,
        color: vector.color ?? `var(--chart-${index + 1})`,
        cue: getLineSeriesCue(index),
      })),
    [vectors]
  );

  // Transform the vectors data for the chart
  const data = useMemo(() => {
    // Find all unique x values from all vectors
    const allXValues = new Set<number>();
    for (const vector of coloredVectors) {
      for (const point of vector.points) {
        allXValues.add(point.x);
      }
    }

    const sortedXValues = Array.from(allXValues).sort((a, b) => a - b);
    const vectorPointMaps = coloredVectors.map((vector) => ({
      id: vector.id,
      pointsByX: new Map(vector.points.map((point) => [point.x, point.y])),
    }));

    // Create data points for each x value
    return sortedXValues.map((x) => {
      const dataPoint: Record<string, number | null> = { x };

      for (const vector of vectorPointMaps) {
        dataPoint[vector.id] = vector.pointsByX.get(x) ?? null;
      }

      return dataPoint;
    });
  }, [coloredVectors]);

  // Create chart config with colors for each vector
  const chartConfig = useMemo(() => {
    const config: ChartConfig = {};

    for (const vector of coloredVectors) {
      config[vector.id] = {
        cue: vector.cue,
        label: vector.name,
        colors: { light: [vector.color], dark: [vector.color] },
      };
    }

    return config;
  }, [coloredVectors]);

  // Process vectors to determine which points need arrow markers
  const processedVectors = useMemo(() => {
    return coloredVectors.map((vector) => {
      // Need at least 2 points to determine direction
      if (vector.points.length < 2) {
        return {
          ...vector,
          startPoint: null,
          endPoint: null,
          arrowAtEnd: false,
          arrowAtStart: false,
        };
      }

      const direction = vector.direction || "forward";

      // Determine which points get the arrow markers based on direction
      if (direction === "forward") {
        // Arrow at the last point (default)
        return {
          ...vector,
          startPoint: vector.points[0],
          endPoint: vector.points.at(-1),
          arrowAtEnd: true,
          arrowAtStart: false,
        };
      }

      if (direction === "both") {
        // Arrows at both ends
        return {
          ...vector,
          startPoint: vector.points[0],
          endPoint: vector.points.at(-1),
          arrowAtEnd: true,
          arrowAtStart: true,
        };
      }

      if (direction === "none") {
        return {
          ...vector,
          startPoint: vector.points[0],
          endPoint: vector.points.at(-1),
          arrowAtEnd: false,
          arrowAtStart: false,
        };
      }

      // Arrow at the first point (backward direction)
      return {
        ...vector,
        startPoint: vector.points.at(-1),
        endPoint: vector.points[0],
        arrowAtEnd: false,
        arrowAtStart: true,
      };
    });
  }, [coloredVectors]);

  return (
    <Card className="content-auto-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <EvilLineChart config={chartConfig} data={data}>
          <Grid />
          <defs>
            {/* Vector arrows for both directions */}
            {processedVectors.map((vector) => {
              return (
                <Fragment key={`arrows-${vector.id}`}>
                  {/* Forward arrow marker (end of line) */}
                  <marker
                    id={`arrow-end-${vector.id}`}
                    markerHeight="8"
                    markerWidth="8"
                    orient="auto"
                    refX="10"
                    refY="5"
                    viewBox="0 0 10 10"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 Z" fill={vector.color} />
                  </marker>
                  {/* Backward arrow marker (start of line) */}
                  <marker
                    id={`arrow-start-${vector.id}`}
                    markerHeight="8"
                    markerWidth="8"
                    orient="auto-start-reverse"
                    refX="10"
                    refY="5"
                    viewBox="0 0 10 10"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 Z" fill={vector.color} />
                  </marker>
                </Fragment>
              );
            })}
          </defs>
          <XAxis
            dataKey="x"
            tickFormatter={(value) => {
              if (typeof value === "number") {
                return Number.isInteger(value)
                  ? value.toString()
                  : value.toFixed(2);
              }
              return value;
            }}
            tickMargin={8}
          />
          <YAxis
            label={{
              value: labels.yAxis,
              angle: -90,
              position: "insideLeft",
              style: { textAnchor: "middle" },
            }}
            tickFormatter={(value) => {
              if (typeof value === "number") {
                return Number.isInteger(value)
                  ? value.toString()
                  : value.toFixed(2);
              }
              return value;
            }}
            tickMargin={8}
          />

          <ChartTooltip content={<VectorChartTooltip />} />

          {processedVectors.map((vector) => {
            // Set marker properties based on direction
            const markerProps: Record<string, string> = {};

            if (vector.arrowAtEnd) {
              markerProps.markerEnd = `url(#arrow-end-${vector.id})`;
            }

            if (vector.arrowAtStart) {
              markerProps.markerStart = `url(#arrow-start-${vector.id})`;
            }

            return (
              <Line
                connectNulls
                curveType={vector.type || "monotone"}
                dataKey={vector.id}
                key={vector.id}
                lineProps={{
                  name: vector.name,
                  stroke: vector.color,
                  strokeDasharray: vector.cue.strokeDasharray,
                  strokeWidth: 2,
                  style: {
                    stroke: vector.color,
                    ...markerProps,
                  },
                }}
              >
                <Dot variant={vector.cue.dot} />
                <ActiveDot variant={vector.cue.activeDot} />
              </Line>
            );
          })}

          <Legend verticalAlign="bottom" />
        </EvilLineChart>
      </CardContent>
    </Card>
  );
}
