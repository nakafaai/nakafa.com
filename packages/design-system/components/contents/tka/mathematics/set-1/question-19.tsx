"use client";

import {
  EvilLineChart,
  Grid,
  Line,
  XAxis,
  YAxis,
} from "@repo/design-system/components/evilcharts/charts/line-chart";
import type { ChartConfig } from "@repo/design-system/components/evilcharts/ui/chart-config";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import type { ReactNode } from "react";

const SINE_REFERENCE_VALUE = Math.sqrt(3) / 2;
const X_AXIS_DOMAIN = [0, 200] as const;
const Y_AXIS_DOMAIN = [-1.2, 1.2] as const;
const X_AXIS_TICKS = [0, 15, 60, 150, 195] as const;
const Y_AXIS_TICKS = [-1, 0, SINE_REFERENCE_VALUE, 1] as const;
const HORIZONTAL_GUIDES = [-1, 0, 1] as const;
const VERTICAL_GUIDES = [0, 15, 195] as const;

interface Props {
  description: ReactNode;
  title: ReactNode;
}

const chartConfig = {
  y: {
    label: "y",
    colors: { light: ["var(--chart-1)"], dark: ["var(--chart-1)"] },
  },
} satisfies ChartConfig;

// Generate data points for y = sin(2x + 60°)
const graphData = Array.from({ length: 200 }, (_, i) => {
  const x = (i / 199) * 200;
  const xRad = (x * Math.PI) / 180;
  const y = Math.sin(2 * xRad + (60 * Math.PI) / 180);

  return { x, y };
});

const horizontalGuideData = HORIZONTAL_GUIDES.map((guide) => ({
  dataKey: `horizontal-${guide}`,
  data: [
    { x: X_AXIS_DOMAIN[0], guide },
    { x: X_AXIS_DOMAIN[1], guide },
  ],
}));

const verticalGuideData = VERTICAL_GUIDES.map((guide) => ({
  dataKey: `vertical-${guide}`,
  data: [
    { x: guide, guide: Y_AXIS_DOMAIN[0] },
    { x: guide, guide: Y_AXIS_DOMAIN[1] },
  ],
}));

/** Renders the coordinate graph for TKA mathematics set 1 question 19. */
export function Graph({ title, description }: Props) {
  return (
    <Card className="content-auto-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <EvilLineChart config={chartConfig} data={graphData}>
          <Grid strokeDasharray="3 3" />
          <XAxis
            dataKey="x"
            domain={X_AXIS_DOMAIN}
            tickFormatter={(value) => `${value}°`}
            ticks={X_AXIS_TICKS}
            type="number"
          />
          <YAxis
            domain={Y_AXIS_DOMAIN}
            label={{
              value: "y",
              position: "insideLeft",
              style: { textAnchor: "middle" },
            }}
            tickFormatter={(value) =>
              value === SINE_REFERENCE_VALUE ? "1/2√3" : String(value)
            }
            ticks={Y_AXIS_TICKS}
            type="number"
          />
          {horizontalGuideData.map((guide) => (
            <Line
              dataKey="guide"
              key={guide.dataKey}
              lineProps={{
                activeDot: false,
                data: guide.data,
                dot: false,
                legendType: "none",
                stroke: "var(--muted-foreground)",
                strokeDasharray:
                  guide.dataKey === "horizontal-0" ? undefined : "3 3",
                tooltipType: "none",
              }}
            />
          ))}
          {verticalGuideData.map((guide) => (
            <Line
              dataKey="guide"
              key={guide.dataKey}
              lineProps={{
                activeDot: false,
                data: guide.data,
                dot: false,
                legendType: "none",
                stroke: "var(--muted-foreground)",
                strokeDasharray: "3 3",
                tooltipType: "none",
              }}
            />
          ))}
          <Line
            curveType="monotone"
            dataKey="y"
            lineProps={{ dot: false, strokeWidth: 2 }}
          />
        </EvilLineChart>
      </CardContent>
    </Card>
  );
}
