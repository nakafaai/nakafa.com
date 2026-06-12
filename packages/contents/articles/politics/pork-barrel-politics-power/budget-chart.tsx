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

const BUDGET_CHART_MARGIN = { right: 16 } as const;

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
      colors: { light: ["var(--chart-4)"], dark: ["var(--chart-4)"] },
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
          chartProps={{ margin: BUDGET_CHART_MARGIN }}
          config={chartConfig}
          data={budgetChartData}
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
            dataKey="budget"
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
