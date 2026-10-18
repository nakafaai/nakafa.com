"use client";

import {
  type ChartData,
  ChartDataProvider,
} from "@repo/design-system/components/contents/mathematics/chart/context";
import { ChartSummaryFacts } from "@repo/design-system/components/contents/mathematics/chart/facts";
import { Bar } from "@repo/design-system/components/evilcharts/charts/bar/series";
import {
  EvilBarChart,
  Grid,
  Tooltip,
  XAxis,
  YAxis,
} from "@repo/design-system/components/evilcharts/charts/bar-chart";
import type { ChartConfig } from "@repo/design-system/components/evilcharts/ui/chart-config";
import {
  VisualCard,
  VisualCardActions,
  VisualCardBody,
  VisualCardFooter,
  VisualCardFullscreen,
  VisualCardHeader,
} from "@repo/design-system/components/visual/card";
import { Array as Arr } from "effect";
import { useMemo } from "react";

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

/** The categories and the one series of a bar chart, which its footer reads. */
function getBarChartData({
  data,
  yAxisLabel,
}: Pick<Props, "data" | "yAxisLabel">): ChartData {
  return {
    categories: Arr.map(data, (item) => item.name),
    series: [
      {
        key: "value",
        label: yAxisLabel,
        values: Arr.map(data, (item) => item.value),
      },
    ],
  };
}

export function HistogramChart({
  title,
  description,
  data,
  chartConfig,
  yAxisLabel,
}: Props) {
  const chartData = useMemo(
    () => getBarChartData({ data, yAxisLabel }),
    [data, yAxisLabel]
  );

  return (
    <ChartDataProvider data={chartData}>
      <VisualCard>
        <VisualCardHeader description={description} title={title} />
        <VisualCardBody className="p-(--card-spacing)">
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
        </VisualCardBody>
        <VisualCardActions>
          <VisualCardFullscreen />
        </VisualCardActions>
        <VisualCardFooter>
          <ChartSummaryFacts />
        </VisualCardFooter>
      </VisualCard>
    </ChartDataProvider>
  );
}

export function BarChart({
  title,
  description,
  data,
  chartConfig,
  yAxisLabel,
}: Props) {
  const chartData = useMemo(
    () => getBarChartData({ data, yAxisLabel }),
    [data, yAxisLabel]
  );

  return (
    <ChartDataProvider data={chartData}>
      <VisualCard>
        <VisualCardHeader description={description} title={title} />
        <VisualCardBody className="p-(--card-spacing)">
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
        </VisualCardBody>
        <VisualCardActions>
          <VisualCardFullscreen />
        </VisualCardActions>
        <VisualCardFooter>
          <ChartSummaryFacts />
        </VisualCardFooter>
      </VisualCard>
    </ChartDataProvider>
  );
}
