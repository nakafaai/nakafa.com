"use client";

import {
  Bar,
  EvilComposedChart,
  Grid,
  Line,
  XAxis,
  YAxis,
} from "@repo/design-system/components/evilcharts/charts/composed-chart";
import type { ChartConfig } from "@repo/design-system/components/evilcharts/ui/chart-config";
import {
  ChartTooltip,
  ChartTooltipContent,
} from "@repo/design-system/components/evilcharts/ui/tooltip";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
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
          colors: { light: ["var(--chart-1)"], dark: ["var(--chart-1)"] },
        },
        barValue: {
          label: yAxisLabel,
          colors: { light: ["var(--chart-2)"], dark: ["var(--chart-2)"] },
        },
      }) satisfies ChartConfig,
    [yAxisLabel]
  );

  return (
    <Card className="content-auto-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <EvilComposedChart
          className="aspect-video"
          config={chartConfig}
          data={chartData}
        >
          <Grid vertical={false} />
          <XAxis dataKey="year" tickMargin={10} />
          <YAxis domain={[4, 6]} tickCount={6} tickMargin={10} />
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
          <Bar barProps={{ barSize: 40 }} dataKey="barValue" radius={4} />
          <Line
            dataKey="growth"
            lineProps={{
              activeDot: { r: 6 },
              dot: { r: 4 },
              strokeWidth: 2,
            }}
          />
        </EvilComposedChart>
      </CardContent>
    </Card>
  );
}
