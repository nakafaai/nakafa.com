"use client";

import {
  Bar,
  EvilBarChart,
  Grid,
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

interface Props {
  chartConfig: ChartConfig;
  data: (Record<string, unknown> & {
    name: string;
    value: number;
  })[];
  description: string;
  title: string;
  yAxisLabel: string;
}

export function HistogramChart({
  title,
  description,
  data,
  chartConfig,
  yAxisLabel,
}: Props) {
  return (
    <Card className="content-auto-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <EvilBarChart
          barCategoryGap={0}
          barGap={0}
          className="aspect-square"
          config={chartConfig}
          data={data}
        >
          <Grid vertical={false} />

          <XAxis dataKey="name" tickMargin={10} />
          <YAxis
            dataKey="value"
            label={{
              value: yAxisLabel,
              angle: -90,
              position: "insideLeft",
              style: { textAnchor: "middle" },
            }}
            tickMargin={10}
          />
          <Tooltip />
          <Bar dataKey="value" radius={0} />
        </EvilBarChart>
      </CardContent>
    </Card>
  );
}

export function BarChart({
  title,
  description,
  data,
  chartConfig,
  yAxisLabel,
}: Props) {
  return (
    <Card className="content-auto-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <EvilBarChart
          className="aspect-square"
          config={chartConfig}
          data={data}
        >
          <Grid vertical={false} />
          <XAxis dataKey="name" tickMargin={10} />
          <YAxis
            dataKey="value"
            label={{
              value: yAxisLabel,
              angle: -90,
              position: "insideLeft",
              style: { textAnchor: "middle" },
            }}
            tickMargin={10}
          />
          <Tooltip />
          <Bar dataKey="value" radius={8} />
        </EvilBarChart>
      </CardContent>
    </Card>
  );
}
