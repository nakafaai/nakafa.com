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
import { getBarSeriesCue } from "@repo/design-system/lib/chart-series-cue";
import { type ReactNode, useMemo } from "react";

const chartData = [
  { class: "A", passed: 15, failed: 5 },
  { class: "B", passed: 20, failed: 10 },
  { class: "C", passed: 24, failed: 6 },
  { class: "D", passed: 30, failed: 20 },
  { class: "E", passed: 25, failed: 15 },
];

const GRADUATION_CUES = {
  failed: getBarSeriesCue(1),
  passed: getBarSeriesCue(0),
};

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
          cue: GRADUATION_CUES.passed,
          label: passedLabel,
          colors: { light: ["var(--chart-1)"], dark: ["var(--chart-1)"] },
        },
        failed: {
          cue: GRADUATION_CUES.failed,
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
          <Bar
            dataKey="passed"
            radius={GRADUATION_CUES.passed.radius}
            variant={GRADUATION_CUES.passed.variant}
          />
          <Bar
            dataKey="failed"
            radius={GRADUATION_CUES.failed.radius}
            variant={GRADUATION_CUES.failed.variant}
          />
        </EvilBarChart>
      </CardContent>
    </Card>
  );
}
