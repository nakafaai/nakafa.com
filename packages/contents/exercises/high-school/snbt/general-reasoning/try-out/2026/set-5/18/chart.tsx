"use client";

import {
  ChartBar,
  ChartCartesianGrid,
  ChartComposedChart,
  type ChartConfig,
  ChartContainer,
  ChartLine,
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
  { year: "2013", growth: 5.58, barValue: 5.58 },
  { year: "2014", growth: 5.01, barValue: null },
  { year: "2015", growth: 4.88, barValue: 4.88 },
  { year: "2016", growth: 5.03, barValue: null },
  { year: "2017", growth: 5.07, barValue: 5.07 },
  { year: "2018", growth: 5.17, barValue: null },
];

interface Props {
  description: ReactNode;
  title: ReactNode;
  yAxisLabel: string;
}

/** Renders Indonesia's GDP growth chart with MDX-owned copy. */
export function GrowthChart({ description, title, yAxisLabel }: Props) {
  const chartConfig = useMemo(
    () =>
      ({
        growth: {
          label: yAxisLabel,
          colors: { light: ["var(--chart-1)"] },
        },
      }) satisfies ChartConfig,
    [yAxisLabel]
  );

  return (
    <Frame>
      <FrameHeader>
        <FrameTitle>{title}</FrameTitle>
        <FrameDescription>{description}</FrameDescription>
      </FrameHeader>
      <FramePanel>
        <ChartContainer className="aspect-video" config={chartConfig}>
          <ChartComposedChart accessibilityLayer data={chartData}>
            <ChartCartesianGrid vertical={false} />
            <ChartXAxis
              axisLine={false}
              dataKey="year"
              tickLine={false}
              tickMargin={10}
            />
            <ChartYAxis
              axisLine={false}
              domain={[4, 6]}
              tickCount={6}
              tickLine={false}
              tickMargin={10}
            />
            <ChartTooltip
              content={({ content, ...props }) => (
                <ChartTooltipContent
                  {...props}
                  payload={props.payload?.filter(
                    (item) => item.dataKey !== "barValue"
                  )}
                />
              )}
            />
            <ChartBar
              barSize={40}
              dataKey="barValue"
              fill="var(--chart-2)"
              radius={[4, 4, 0, 0]}
            />
            <ChartLine
              activeDot={{
                r: 6,
              }}
              dataKey="growth"
              dot={{
                r: 4,
                fill: "var(--chart-1)",
              }}
              stroke="var(--chart-1)"
              strokeWidth={2}
              type="linear"
            />
          </ChartComposedChart>
        </ChartContainer>
      </FramePanel>
    </Frame>
  );
}
