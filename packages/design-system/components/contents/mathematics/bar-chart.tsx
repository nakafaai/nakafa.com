"use client";

import type { ChartConfig } from "@repo/design-system/components/charts/chart";
import {
  ChartBar,
  ChartBarChart,
  ChartCartesianGrid,
  ChartContainer,
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

interface Props {
  chartConfig: ChartConfig;
  data: {
    name: string;
    value: number;
  }[];
  description: string;
  title: string;
  yAxisLabel: string;
}

export function HistogramChart({
  title,
  description,
  data,
  chartConfig,
  yAxisLabel,
}: Props) {
  return (
    <Frame>
      <FrameHeader>
        <FrameTitle>{title}</FrameTitle>
        <FrameDescription>{description}</FrameDescription>
      </FrameHeader>
      <FramePanel>
        <ChartContainer className="aspect-square" config={chartConfig}>
          <ChartBarChart
            accessibilityLayer
            barCategoryGap={0}
            barGap={0}
            data={data}
          >
            <ChartCartesianGrid vertical={false} />

            <ChartXAxis
              axisLine={false}
              dataKey="name"
              tickLine={false}
              tickMargin={10}
            />
            <ChartYAxis
              axisLine={false}
              dataKey="value"
              label={{
                value: yAxisLabel,
                angle: -90,
                position: "insideLeft",
                style: { textAnchor: "middle" },
              }}
              tickLine={false}
              tickMargin={10}
            />
            <ChartTooltip
              content={<ChartTooltipContent indicator="line" />}
              cursor={false}
            />
            <ChartBar dataKey="value" radius={0} />
          </ChartBarChart>
        </ChartContainer>
      </FramePanel>
    </Frame>
  );
}

export function BarChart({
  title,
  description,
  data,
  chartConfig,
  yAxisLabel,
}: Props) {
  return (
    <Frame>
      <FrameHeader>
        <FrameTitle>{title}</FrameTitle>
        <FrameDescription>{description}</FrameDescription>
      </FrameHeader>
      <FramePanel>
        <ChartContainer className="aspect-square" config={chartConfig}>
          <ChartBarChart accessibilityLayer data={data}>
            <ChartCartesianGrid vertical={false} />
            <ChartXAxis
              axisLine={false}
              dataKey="name"
              tickLine={false}
              tickMargin={10}
            />
            <ChartYAxis
              axisLine={false}
              dataKey="value"
              label={{
                value: yAxisLabel,
                angle: -90,
                position: "insideLeft",
                style: { textAnchor: "middle" },
              }}
              tickLine={false}
              tickMargin={10}
            />
            <ChartTooltip
              content={<ChartTooltipContent indicator="line" />}
              cursor={false}
            />
            <ChartBar dataKey="value" radius={8} />
          </ChartBarChart>
        </ChartContainer>
      </FramePanel>
    </Frame>
  );
}
