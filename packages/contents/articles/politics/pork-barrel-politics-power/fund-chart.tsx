"use client";

import {
  Bar,
  EvilBarChart,
  Grid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from "@repo/design-system/components/evilcharts/charts/bar-chart";
import type { ChartConfig } from "@repo/design-system/components/evilcharts/ui/chart-config";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import type { ReactNode } from "react";

const FUND_CHART_MARGIN = { right: 16 } as const;

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
      colors: { light: ["var(--chart-5)"], dark: ["var(--chart-5)"] },
    },
  } satisfies ChartConfig;

  return (
    <Card className="content-auto-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <EvilBarChart
          chartProps={{ margin: FUND_CHART_MARGIN }}
          config={chartConfig}
          data={fundChartData}
        >
          <Grid vertical={false} />
          <XAxis dataKey="year" tickMargin={10} />
          <YAxis
            label={{
              value: yLabel,
              angle: -90,
              position: "insideLeft",
              style: { textAnchor: "middle" },
            }}
          />
          <Tooltip />
          <Bar
            barProps={{ label: { position: "top", fontSize: 12 } }}
            dataKey="fund"
            radius={8}
          />
          <Legend />
        </EvilBarChart>
      </CardContent>
      <CardFooter>
        <p className="text-sm">{footnote}</p>
      </CardFooter>
    </Card>
  );
}
