"use client";

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
  VisualCardBody,
  VisualCardFooter,
  VisualCardFullscreen,
  VisualCardHeader,
  VisualCardScene,
} from "@repo/design-system/components/visual/card";

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
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardBody>
        <VisualCardScene>
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
        </VisualCardScene>
      </VisualCardBody>
      <VisualCardFooter>
        <VisualCardFullscreen />
      </VisualCardFooter>
    </VisualCard>
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
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardBody>
        <VisualCardScene>
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
        </VisualCardScene>
      </VisualCardBody>
      <VisualCardFooter>
        <VisualCardFullscreen />
      </VisualCardFooter>
    </VisualCard>
  );
}
