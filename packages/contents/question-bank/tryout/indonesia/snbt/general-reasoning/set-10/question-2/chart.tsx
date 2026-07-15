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
import { getBarSeriesCue } from "@repo/design-system/lib/charts/series-cue";
import { type ReactNode, useMemo } from "react";

const chartData = [
  { division: "A", rejected: 20, accepted: 30 },
  { division: "B", rejected: 30, accepted: 20 },
  { division: "C", rejected: 10, accepted: 50 },
  { division: "D", rejected: 30, accepted: 90 },
  { division: "E", rejected: 25, accepted: 50 },
];

const RECRUITMENT_CUES = {
  accepted: getBarSeriesCue(1),
  rejected: getBarSeriesCue(0),
};

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
          cue: RECRUITMENT_CUES.rejected,
          label: rejectedLabel,
          colors: { light: ["var(--chart-1)"], dark: ["var(--chart-1)"] },
        },
        accepted: {
          cue: RECRUITMENT_CUES.accepted,
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
          <Bar
            dataKey="rejected"
            radius={RECRUITMENT_CUES.rejected.radius}
            variant={RECRUITMENT_CUES.rejected.variant}
          />
          <Bar
            dataKey="accepted"
            radius={RECRUITMENT_CUES.accepted.radius}
            variant={RECRUITMENT_CUES.accepted.variant}
          />
        </EvilBarChart>
      </CardContent>
    </Card>
  );
}
