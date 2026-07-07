"use client";

import {
  Bar,
  EvilBarChart,
  Grid,
  Legend,
  XAxis,
  YAxis,
} from "@repo/design-system/components/evilcharts/charts/bar-chart";
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
          colors: { light: ["var(--chart-1)"], dark: ["var(--chart-1)"] },
        },
        revenue: {
          label: revenueLabel,
          colors: { light: ["var(--chart-2)"], dark: ["var(--chart-2)"] },
        },
      }) satisfies ChartConfig,
    [capitalLabel, revenueLabel]
  );

  const formatYear = (value: string) => `${yearLabel}${value}`;

  return (
    <Card className="content-auto-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <EvilBarChart
          className="aspect-video"
          config={chartConfig}
          data={chartData}
        >
          <Grid vertical={false} />
          <XAxis dataKey="year" tickFormatter={formatYear} tickMargin={10} />
          <YAxis tickMargin={10} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(value) => formatYear(String(value))}
              />
            }
          />
          <Legend />
          <Bar dataKey="capital" radius={4} />
          <Bar dataKey="revenue" radius={4} />
        </EvilBarChart>
      </CardContent>
    </Card>
  );
}
