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

interface BudgetChartProps {
  description: ReactNode;
  footnote: ReactNode;
  labels: {
    budget: ReactNode;
  };
  title: ReactNode;
  yLabel: string;
}

const budgetChartData = [
  {
    year: "2020",
    budget: 498,
  },
  {
    year: "2021",
    budget: 468.2,
  },
  {
    year: "2022",
    budget: 460.6,
  },
  {
    year: "2023",
    budget: 439.1,
  },
  {
    year: "2024",
    budget: 496.8,
  },
];

/** Renders the social protection budget chart with MDX-owned copy. */
export function BudgetChart({
  title,
  description,
  yLabel,
  footnote,
  labels,
}: BudgetChartProps) {
  const chartConfig = {
    budget: {
      label: labels.budget,
      colors: { light: ["var(--chart-4)"] },
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
            data={budgetChartData}
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
            <ChartBar dataKey="budget" fill="var(--color-budget-0)" radius={8}>
              <ChartLabelList
                className="fill-foreground"
                dataKey="budget"
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
