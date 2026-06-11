"use client";

import {
  ChartBar,
  ChartBarChart,
  ChartCartesianGrid,
  type ChartConfig,
  ChartContainer,
  ChartLabelList,
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
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@repo/design-system/components/ui/frame";
import type { ReactNode } from "react";

interface FundChartProps {
  description: ReactNode;
  footnote: ReactNode;
  labels: {
    fund: ReactNode;
  };
  title: ReactNode;
  yLabel: string;
}

const fundChartData = [
  {
    year: "2015",
    fund: 16.7,
  },
  {
    year: "2016",
    fund: 9.3,
  },
  {
    year: "2017",
    fund: 13.1,
  },
  {
    year: "2018",
    fund: 17.6,
  },
];

/** Renders the social assistance fund chart with MDX-owned copy. */
export function FundChart({
  title,
  description,
  yLabel,
  footnote,
  labels,
}: FundChartProps) {
  const chartConfig = {
    fund: {
      label: labels.fund,
      colors: { light: ["var(--chart-5)"] },
    },
    label: {
      colors: { light: ["var(--foreground)"] },
    },
  } satisfies ChartConfig;

  return (
    <Frame>
      <FrameHeader>
        <FrameTitle>{title}</FrameTitle>
        <FrameDescription>{description}</FrameDescription>
      </FrameHeader>
      <FramePanel>
        <ChartContainer config={chartConfig}>
          <ChartBarChart
            accessibilityLayer
            data={fundChartData}
            margin={{
              right: 16,
            }}
          >
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
                value: yLabel,
                angle: -90,
                position: "insideLeft",
                style: { textAnchor: "middle" },
              }}
              tickLine={false}
            />
            <ChartTooltip
              content={<ChartTooltipContent indicator="line" />}
              cursor={false}
            />
            <ChartBar dataKey="fund" fill="var(--color-fund-0)" radius={8}>
              <ChartLabelList
                className="fill-foreground"
                dataKey="fund"
                fontSize={12}
                offset={8}
                position="top"
              />
            </ChartBar>
            <ChartLegend content={<ChartLegendContent />} />
          </ChartBarChart>
        </ChartContainer>
      </FramePanel>
      <FrameFooter>
        <p className="text-sm">{footnote}</p>
      </FrameFooter>
    </Frame>
  );
}
