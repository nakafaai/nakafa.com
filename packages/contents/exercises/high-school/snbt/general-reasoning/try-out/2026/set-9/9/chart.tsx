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
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
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
          colors: { light: ["var(--chart-1)"], dark: ["var(--chart-1)"] },
        },
        failed: {
          label: failedLabel,
          colors: { light: ["var(--chart-2)"], dark: ["var(--chart-2)"] },
        },
      }) satisfies ChartConfig,
    [failedLabel, passedLabel]
  );

  return (
    <Card className="content-auto-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <EvilBarChart className="aspect-video" config={chartConfig} data={data}>
          <Grid vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="formattedClass"
            tickLine={false}
            tickMargin={10}
          />
          <YAxis axisLine={false} tickLine={false} tickMargin={10} />
          <Tooltip />
          <Legend />
          <Bar dataKey="passed" radius={4} />
          <Bar dataKey="failed" radius={4} />
        </EvilBarChart>
      </CardContent>
    </Card>
  );
}
