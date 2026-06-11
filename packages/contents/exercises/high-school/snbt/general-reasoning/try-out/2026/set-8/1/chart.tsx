"use client";

import {
  ChartBar,
  ChartBarChart,
  ChartCartesianGrid,
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
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
import { type ReactNode, useMemo } from "react";

const chartData = [
  { year: "1", A: 260, B: 250, C: 225 },
  { year: "2", A: 390, B: 275, C: 280 },
  { year: "3", A: 425, B: 350, C: 320 },
  { year: "4", A: 450, B: 385, C: 400 },
  { year: "5", A: 520, B: 450, C: 495 },
];

interface Props {
  description: ReactNode;
  seriesLabels: {
    A: ReactNode;
    B: ReactNode;
    C: ReactNode;
  };
  title: ReactNode;
  yAxisLabel: string;
  yearLabel: string;
}

/** Renders the flower shop sales chart with MDX-owned copy. */
export function SalesChart({
  description,
  seriesLabels,
  title,
  yAxisLabel,
  yearLabel,
}: Props) {
  const chartConfig = useMemo(
    () =>
      ({
        A: {
          label: seriesLabels.A,
          colors: { light: ["var(--chart-1)"] },
        },
        B: {
          label: seriesLabels.B,
          colors: { light: ["var(--chart-2)"] },
        },
        C: {
          label: seriesLabels.C,
          colors: { light: ["var(--chart-3)"] },
        },
      }) satisfies ChartConfig,
    [seriesLabels.A, seriesLabels.B, seriesLabels.C]
  );

  const formatYear = (value: string) => `${yearLabel}${value}`;

  return (
    <Frame>
      <FrameHeader>
        <FrameTitle>{title}</FrameTitle>
        <FrameDescription>{description}</FrameDescription>
      </FrameHeader>
      <FramePanel>
        <ChartContainer className="aspect-video" config={chartConfig}>
          <ChartBarChart accessibilityLayer data={chartData}>
            <ChartCartesianGrid vertical={false} />
            <ChartXAxis
              axisLine={false}
              dataKey="year"
              tickFormatter={formatYear}
              tickLine={false}
              tickMargin={10}
            />
            <ChartYAxis
              axisLine={false}
              label={{
                value: yAxisLabel,
                angle: -90,
                position: "insideLeft",
                offset: 10,
                style: { textAnchor: "middle" },
              }}
              tickLine={false}
              tickMargin={10}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => formatYear(String(value))}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            {Object.keys(chartConfig).map((key) => (
              <ChartBar
                dataKey={key}
                fill={`var(--color-${key}-0)`}
                key={key}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </ChartBarChart>
        </ChartContainer>
      </FramePanel>
    </Frame>
  );
}
