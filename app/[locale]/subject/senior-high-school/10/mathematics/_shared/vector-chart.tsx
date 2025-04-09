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
} from "@/components/ui/chart";
import { Fragment, useMemo } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

type Vector = {
  /**
   * Unique identifier for the vector
   */
  id: string;
  /**
   * Name of the vector
   */
  name: string;
  /**
   * Color of the vector
   */
  color?: string;
  /**
   * Points of the vector
   */
  points: {
    x: number;
    y: number;
  }[];
  /**
   * Direction of the vector arrow
   */
  direction?: "forward" | "backward" | "both";
};

type Props = {
  /**
   * Title of the chart
   */
  title: string;
  /**
   * Description of the chart
   */
  description: string;
  /**
   * Vectors to display in the chart
   */
  vectors: Vector[];
  /**
   * Labels for the x and y axes
   */
  labels?: {
    /**
     * Label for the x axis
     * @default "x"
     */
    xAxis: string;
    /**
     * Label for the y axis
     * @default "y"
     */
    yAxis: string;
  };
};

export function VectorChart({
  title,
  description,
  vectors,
  labels = { xAxis: "x", yAxis: "y" },
}: Props) {
  // Transform the vectors data for the chart
  const data = useMemo(() => {
    // Find all unique x values from all vectors
    const allXValues = new Set<number>();
    for (const vector of vectors) {
      for (const point of vector.points) {
        allXValues.add(point.x);
      }
    }

    // Sort the x values
    const sortedXValues = [...allXValues].sort((a, b) => a - b);

    // Create data points for each x value
    return sortedXValues.map((x) => {
      const dataPoint: Record<string, number | null> = { x };

      // Add the y value for each vector at this x point if it exists
      for (const vector of vectors) {
        const point = vector.points.find((p) => p.x === x);
        dataPoint[vector.id] = point?.y ?? null;
      }

      return dataPoint;
    });
  }, [vectors]);

  // Create chart config with colors for each vector
  const chartConfig = useMemo(() => {
    const config: ChartConfig = {};

    vectors.forEach((vector, index) => {
      config[vector.id] = {
        label: vector.name,
        color: vector.color || `var(--chart-${index + 1})`,
      };
    });

    return config;
  }, [vectors]);

  // Process vectors to determine which points need arrow markers
  const processedVectors = useMemo(() => {
    return vectors.map((vector) => {
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

      // Arrow at the first point (backward direction)
      return {
        ...vector,
        startPoint: vector.points.at(-1),
        endPoint: vector.points[0],
        arrowAtEnd: false,
        arrowAtStart: true,
      };
    });
  }, [vectors]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <LineChart data={data} accessibilityLayer>
            <CartesianGrid />
            <defs>
              {/* Vector arrows for both directions */}
              {processedVectors.map((vector, index) => {
                const color = vector.color || `var(--chart-${index + 1})`;
                return (
                  <Fragment key={`arrows-${vector.id}`}>
                    {/* Forward arrow marker (end of line) */}
                    <marker
                      id={`arrow-end-${vector.id}`}
                      viewBox="0 0 10 10"
                      refX="10"
                      refY="5"
                      markerWidth="8"
                      markerHeight="8"
                      orient="auto"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 Z" fill={color} />
                    </marker>
                    {/* Backward arrow marker (start of line) */}
                    <marker
                      id={`arrow-start-${vector.id}`}
                      viewBox="0 0 10 10"
                      refX="10"
                      refY="5"
                      markerWidth="8"
                      markerHeight="8"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 Z" fill={color} />
                    </marker>
                  </Fragment>
                );
              })}
            </defs>
            <XAxis
              dataKey="x"
              tickMargin={8}
              tickFormatter={(value) => {
                return value.toString();
              }}
            />
            <YAxis
              tickMargin={8}
              label={{
                value: labels.yAxis,
                angle: -90,
                position: "insideLeft",
                style: { textAnchor: "middle" },
              }}
            />

            <ChartTooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const xValue = payload[0]?.payload.x;

                  return (
                    <div className="grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
                      {payload.map((entry, index) => {
                        if (entry.value === null) {
                          return null;
                        }

                        const vectorName = entry.name;
                        const yValue = entry.value;
                        const color = entry.color;

                        return (
                          <div
                            key={`tooltip-${index}`}
                            className="flex items-center gap-2"
                          >
                            <div
                              className="h-2 w-2 shrink-0 rounded-[2px]"
                              style={{ backgroundColor: color }}
                            />
                            <span className="font-medium">{vectorName}</span>
                            <span className="ml-auto font-mono tracking-tight">
                              ({xValue}, {yValue})
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                }
                return null;
              }}
            />

            {processedVectors.map((vector, index) => {
              const color = vector.color || `var(--chart-${index + 1})`;

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
                  key={vector.id}
                  type="monotone"
                  dataKey={vector.id}
                  stroke={color}
                  strokeWidth={2}
                  dot
                  name={vector.name}
                  connectNulls
                  style={{
                    stroke: color,
                    ...markerProps,
                  }}
                />
              );
            })}

            <ChartLegend
              content={<ChartLegendContent verticalAlign="bottom" />}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
