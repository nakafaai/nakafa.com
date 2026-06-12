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
  { division: "A", rejected: 20, accepted: 30 },
  { division: "B", rejected: 30, accepted: 20 },
  { division: "C", rejected: 10, accepted: 50 },
  { division: "D", rejected: 30, accepted: 90 },
  { division: "E", rejected: 25, accepted: 50 },
];

interface Props {
  acceptedLabel: ReactNode;
  description: ReactNode;
  divisionLabel: string;
  rejectedLabel: ReactNode;
  title: ReactNode;
}

/** Renders the employee recruitment chart with MDX-owned copy. */
export function RecruitmentChart({
  acceptedLabel,
  description,
  divisionLabel,
  rejectedLabel,
  title,
}: Props) {
  const data = useMemo(
    () =>
      chartData.map((item) => ({
        ...item,
        formattedDivision: `${divisionLabel} ${item.division}`,
      })),
    [divisionLabel]
  );

  const chartConfig = useMemo(
    () =>
      ({
        rejected: {
          label: rejectedLabel,
          colors: { light: ["var(--chart-1)"], dark: ["var(--chart-1)"] },
        },
        accepted: {
          label: acceptedLabel,
          colors: { light: ["var(--chart-2)"], dark: ["var(--chart-2)"] },
        },
      }) satisfies ChartConfig,
    [acceptedLabel, rejectedLabel]
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
            dataKey="formattedDivision"
            tickLine={false}
            tickMargin={10}
          />
          <YAxis axisLine={false} tickLine={false} tickMargin={10} />
          <Tooltip />
          <Legend />
          <Bar dataKey="rejected" radius={4} />
          <Bar dataKey="accepted" radius={4} />
        </EvilBarChart>
      </CardContent>
    </Card>
  );
}
