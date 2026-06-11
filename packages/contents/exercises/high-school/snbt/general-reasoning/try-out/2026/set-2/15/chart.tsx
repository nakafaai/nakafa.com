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
  { month: "Januari", grainPrice: 5353, governmentPrice: 3700 },
  { month: "Februari", grainPrice: 5114, governmentPrice: 3700 },
  { month: "Maret", grainPrice: 4604, governmentPrice: 3700 },
  { month: "April", grainPrice: 4357, governmentPrice: 3700 },
] as const;

type ChartMonth = (typeof chartData)[number]["month"];

interface Props {
  description: ReactNode;
  monthLabels: Record<ChartMonth, string>;
  seriesLabels: {
    governmentPrice: ReactNode;
    grainPrice: ReactNode;
  };
  title: ReactNode;
  yAxisLabel: string;
}

/** Renders the grain price chart with MDX-owned copy. */
export function SalesChart({
  description,
  monthLabels,
  seriesLabels,
  title,
  yAxisLabel,
}: Props) {
  const chartConfig = useMemo(
    () =>
      ({
        grainPrice: {
          label: seriesLabels.grainPrice,
          colors: { light: ["var(--chart-1)"] },
        },
        governmentPrice: {
          label: seriesLabels.governmentPrice,
          colors: { light: ["var(--chart-2)"] },
        },
      }) satisfies ChartConfig,
    [seriesLabels.governmentPrice, seriesLabels.grainPrice]
  );

  const translatedData = useMemo(
    () =>
      chartData.map((item) => ({
        ...item,
        month: monthLabels[item.month],
      })),
    [monthLabels]
  );

  return (
    <Frame>
      <FrameHeader>
        <FrameTitle>{title}</FrameTitle>
        <FrameDescription>{description}</FrameDescription>
      </FrameHeader>
      <FramePanel>
        <ChartContainer className="aspect-video" config={chartConfig}>
          <ChartLineChart accessibilityLayer data={translatedData}>
            <ChartCartesianGrid vertical={false} />
            <ChartXAxis
              axisLine={false}
              dataKey="month"
              tickLine={false}
              tickMargin={10}
            />
            <ChartYAxis
              axisLine={false}
              domain={[3000, 6000]}
              label={{
                value: yAxisLabel,
                angle: -90,
                position: "insideLeft",
                offset: 0,
              }}
              tickFormatter={(value) => `${value / 1000}k`}
              tickLine={false}
              tickMargin={10}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <ChartLine
              dataKey="grainPrice"
              dot={{ r: 4 }}
              stroke="var(--color-grainPrice-0)"
              strokeWidth={2}
              type="monotone"
            />
            <ChartLine
              dataKey="governmentPrice"
              dot={{ r: 4 }}
              stroke="var(--color-governmentPrice-0)"
              strokeWidth={2}
              type="monotone"
            />
          </ChartLineChart>
        </ChartContainer>
      </FramePanel>
    </Frame>
  );
}
