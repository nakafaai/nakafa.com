"use client";

import {
  ChartCartesianGrid,
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartLine,
  ChartLineChart,
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
  { day: "monday", library: 150, laboratory: 250 },
  { day: "tuesday", library: 135, laboratory: 210 },
  { day: "wednesday", library: 100, laboratory: 140 },
  { day: "thursday", library: 140, laboratory: 170 },
  { day: "friday", library: 165, laboratory: 120 },
] as const;

type ChartDay = (typeof chartData)[number]["day"];

interface Props {
  dayLabels: Record<ChartDay, string>;
  description: ReactNode;
  seriesLabels: {
    laboratory: ReactNode;
    library: ReactNode;
  };
  title: ReactNode;
  yAxisLabel: string;
}

/** Renders the school facility visitor chart with MDX-owned copy. */
export function VisitorChart({
  dayLabels,
  description,
  seriesLabels,
  title,
  yAxisLabel,
}: Props) {
  const data = useMemo(
    () =>
      chartData.map((item) => ({
        ...item,
        day: dayLabels[item.day],
      })),
    [dayLabels]
  );

  const chartConfig = useMemo(
    () =>
      ({
        library: {
          label: seriesLabels.library,
          colors: { light: ["var(--chart-1)"] },
        },
        laboratory: {
          label: seriesLabels.laboratory,
          colors: { light: ["var(--chart-2)"] },
        },
      }) satisfies ChartConfig,
    [seriesLabels.laboratory, seriesLabels.library]
  );

  return (
    <Frame>
      <FrameHeader>
        <FrameTitle>{title}</FrameTitle>
        <FrameDescription>{description}</FrameDescription>
      </FrameHeader>
      <FramePanel>
        <ChartContainer className="aspect-video" config={chartConfig}>
          <ChartLineChart accessibilityLayer data={data}>
            <ChartCartesianGrid vertical={false} />
            <ChartXAxis
              axisLine={false}
              dataKey="day"
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
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <ChartLine
              dataKey="library"
              dot={{ r: 4 }}
              stroke="var(--color-library-0)"
              strokeWidth={2}
            />
            <ChartLine
              dataKey="laboratory"
              dot={{ r: 4 }}
              stroke="var(--color-laboratory-0)"
              strokeWidth={2}
            />
          </ChartLineChart>
        </ChartContainer>
      </FramePanel>
    </Frame>
  );
}
