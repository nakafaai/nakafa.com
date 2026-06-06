"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
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
} from "@repo/design-system/components/ui/chart";
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
          colors: { light: ["var(--chart-1)"] },
        },
        accepted: {
          label: acceptedLabel,
          colors: { light: ["var(--chart-2)"] },
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
        <ChartContainer className="aspect-video" config={chartConfig}>
          <ChartBarChart accessibilityLayer data={data}>
            <ChartCartesianGrid vertical={false} />
            <ChartXAxis
              axisLine={false}
              dataKey="formattedDivision"
              tickLine={false}
              tickMargin={10}
            />
            <ChartYAxis axisLine={false} tickLine={false} tickMargin={10} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <ChartBar
              dataKey="rejected"
              fill="var(--color-rejected-0)"
              radius={[4, 4, 0, 0]}
            />
            <ChartBar
              dataKey="accepted"
              fill="var(--color-accepted-0)"
              radius={[4, 4, 0, 0]}
            />
          </ChartBarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
