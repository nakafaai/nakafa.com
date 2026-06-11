"use client";

import {
  ChartCartesianGrid,
  type ChartConfig,
  ChartContainer,
  ChartLabel,
  ChartLine,
  ChartLineChart,
  ChartReferenceLine,
  ChartXAxis,
  ChartYAxis,
} from "@repo/design-system/components/charts/chart";
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@repo/design-system/components/ui/frame";
import type { ReactNode } from "react";

interface Props {
  description: ReactNode;
  title: ReactNode;
}

const chartConfig = {
  y: {
    label: "y",
    colors: { light: ["var(--chart-1)"] },
  },
} satisfies ChartConfig;

// Generate data points for y = sin(2x + 60°)
const graphData = Array.from({ length: 200 }, (_, i) => {
  const x = (i / 199) * 200;
  const xRad = (x * Math.PI) / 180;
  const y = Math.sin(2 * xRad + (60 * Math.PI) / 180);

  return { x, y };
});

export function Graph({ title, description }: Props) {
  return (
    <Frame>
      <FrameHeader>
        <FrameTitle>{title}</FrameTitle>
        <FrameDescription>{description}</FrameDescription>
      </FrameHeader>
      <FramePanel>
        <ChartContainer config={chartConfig}>
          <ChartLineChart data={graphData}>
            <ChartCartesianGrid strokeDasharray="3 3" />
            <ChartXAxis
              dataKey="x"
              domain={[0, 200]}
              tickFormatter={(value) => `${value}°`}
              ticks={[0, 15, 60, 150, 195]}
              type="number"
            />
            <ChartYAxis
              domain={[-1.2, 1.2]}
              label={{
                value: "y",
                position: "insideLeft",
                style: { textAnchor: "middle" },
              }}
              ticks={[-1, 0, 1]}
              type="number"
            />
            <ChartReferenceLine stroke="transparent" y={0.866}>
              <ChartLabel
                offset={10}
                position="left"
                style={{ fill: "var(--muted-foreground)" }}
                value="1/2√3"
              />
            </ChartReferenceLine>
            <ChartReferenceLine
              stroke="var(--muted-foreground)"
              strokeDasharray="3 3"
              y={1}
            />
            <ChartReferenceLine stroke="var(--muted-foreground)" y={0} />
            <ChartReferenceLine
              stroke="var(--muted-foreground)"
              strokeDasharray="3 3"
              y={-1}
            />
            <ChartReferenceLine
              stroke="var(--muted-foreground)"
              strokeDasharray="3 3"
              x={0}
            />
            <ChartReferenceLine
              stroke="var(--muted-foreground)"
              strokeDasharray="3 3"
              x={15}
            />
            <ChartReferenceLine
              stroke="var(--muted-foreground)"
              strokeDasharray="3 3"
              x={195}
            />
            <ChartLine
              dataKey="y"
              dot={false}
              stroke="var(--color-y-0)"
              strokeWidth={2}
              type="monotone"
            />
          </ChartLineChart>
        </ChartContainer>
      </FramePanel>
    </Frame>
  );
}
