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
  { year: "1", capital: 50, revenue: 150 },
  { year: "2", capital: 100, revenue: 200 },
  { year: "3", capital: 100, revenue: 250 },
  { year: "4", capital: 150, revenue: 250 },
  { year: "5", capital: 200, revenue: 300 },
];

interface Props {
  capitalLabel: ReactNode;
  description: ReactNode;
  revenueLabel: ReactNode;
  title: ReactNode;
  yearLabel: string;
}

/** Renders the store capital and revenue chart with MDX-owned copy. */
export function ProfitChart({
  capitalLabel,
  description,
  revenueLabel,
  title,
  yearLabel,
}: Props) {
  const chartConfig = useMemo(
    () =>
      ({
        capital: {
          label: capitalLabel,
          colors: { light: ["var(--chart-1)"] },
        },
        revenue: {
          label: revenueLabel,
          colors: { light: ["var(--chart-2)"] },
        },
      }) satisfies ChartConfig,
    [capitalLabel, revenueLabel]
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
            <ChartYAxis axisLine={false} tickLine={false} tickMargin={10} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => formatYear(String(value))}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <ChartBar
              dataKey="capital"
              fill="var(--color-capital-0)"
              radius={[4, 4, 0, 0]}
            />
            <ChartBar
              dataKey="revenue"
              fill="var(--color-revenue-0)"
              radius={[4, 4, 0, 0]}
            />
          </ChartBarChart>
        </ChartContainer>
      </FramePanel>
    </Frame>
  );
}
