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
  { year: "2017", mieA: 3500, mieB: 4500, mieC: 2250 },
  { year: "2018", mieA: 2500, mieB: 4250, mieC: 2500 },
  { year: "2019", mieA: 3350, mieB: 4000, mieC: 2800 },
  { year: "2020", mieA: 3000, mieB: 4500, mieC: 2650 },
];

interface Props {
  description: ReactNode;
  seriesLabels: {
    mieA: ReactNode;
    mieB: ReactNode;
    mieC: ReactNode;
  };
  title: ReactNode;
  yAxisLabel: string;
}

/** Renders the instant noodle price chart with MDX-owned copy. */
export function PriceChart({
  description,
  seriesLabels,
  title,
  yAxisLabel,
}: Props) {
  const chartConfig = useMemo(
    () =>
      ({
        mieA: {
          label: seriesLabels.mieA,
          colors: { light: ["var(--chart-1)"] },
        },
        mieB: {
          label: seriesLabels.mieB,
          colors: { light: ["var(--chart-2)"] },
        },
        mieC: {
          label: seriesLabels.mieC,
          colors: { light: ["var(--chart-3)"] },
        },
      }) satisfies ChartConfig,
    [seriesLabels.mieA, seriesLabels.mieB, seriesLabels.mieC]
  );

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
              tickLine={false}
              tickMargin={10}
            />
            <ChartYAxis
              axisLine={false}
              label={{
                value: yAxisLabel,
                angle: -90,
                position: "insideLeft",
              }}
              tickFormatter={(value) => `${value / 1000}k`}
              tickLine={false}
              tickMargin={10}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
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
