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
  { class: "A", passed: 15, failed: 5 },
  { class: "B", passed: 20, failed: 10 },
  { class: "C", passed: 24, failed: 6 },
  { class: "D", passed: 30, failed: 20 },
  { class: "E", passed: 25, failed: 15 },
];

interface Props {
  classLabel: string;
  description: ReactNode;
  failedLabel: ReactNode;
  passedLabel: ReactNode;
  title: ReactNode;
}

/** Renders the mathematics exam graduation chart with MDX-owned copy. */
export function GraduationChart({
  classLabel,
  description,
  failedLabel,
  passedLabel,
  title,
}: Props) {
  const data = useMemo(
    () =>
      chartData.map((item) => ({
        ...item,
        formattedClass: `${classLabel} ${item.class}`,
      })),
    [classLabel]
  );

  const chartConfig = useMemo(
    () =>
      ({
        passed: {
          label: passedLabel,
          colors: { light: ["var(--chart-1)"] },
        },
        failed: {
          label: failedLabel,
          colors: { light: ["var(--chart-2)"] },
        },
      }) satisfies ChartConfig,
    [failedLabel, passedLabel]
  );

  return (
    <Frame>
      <FrameHeader>
        <FrameTitle>{title}</FrameTitle>
        <FrameDescription>{description}</FrameDescription>
      </FrameHeader>
      <FramePanel>
        <ChartContainer className="aspect-video" config={chartConfig}>
          <ChartBarChart accessibilityLayer data={data}>
            <ChartCartesianGrid vertical={false} />
            <ChartXAxis
              axisLine={false}
              dataKey="formattedClass"
              tickLine={false}
              tickMargin={10}
            />
            <ChartYAxis axisLine={false} tickLine={false} tickMargin={10} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <ChartBar
              dataKey="passed"
              fill="var(--color-passed-0)"
              radius={[4, 4, 0, 0]}
            />
            <ChartBar
              dataKey="failed"
              fill="var(--color-failed-0)"
              radius={[4, 4, 0, 0]}
            />
          </ChartBarChart>
        </ChartContainer>
      </FramePanel>
    </Frame>
  );
}
