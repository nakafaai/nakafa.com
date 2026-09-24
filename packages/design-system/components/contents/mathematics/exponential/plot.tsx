"use client";

import type { resolveExponential } from "@repo/design-system/components/contents/mathematics/exponential";
import { Line } from "@repo/design-system/components/evilcharts/charts/composed/line";
import { Scatter } from "@repo/design-system/components/evilcharts/charts/composed/scatter";
import {
  EvilComposedChart,
  Grid,
  Legend,
  XAxis,
  YAxis,
} from "@repo/design-system/components/evilcharts/charts/composed-chart";
import type { ChartConfig } from "@repo/design-system/components/evilcharts/ui/chart-config";
import {
  ChartTooltip,
  ChartTooltipContent,
} from "@repo/design-system/components/evilcharts/ui/tooltip";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import type { Effect } from "effect";
import { useFormatter } from "next-intl";

const CHART_CONFIG = {
  y: {
    label: <InlineMath math="f(x)" />,
    colors: { light: ["var(--chart-1)"], dark: ["var(--chart-1)"] },
  },
} satisfies ChartConfig;

/** Draws the server-resolved curve and discrete observations. */
export function ExponentialPlot(
  plot: Effect.Success<ReturnType<typeof resolveExponential>>
) {
  const formatter = useFormatter();
  const formatNumber = (value: number) =>
    formatter.number(value, { maximumSignificantDigits: 10 });
  return (
    <EvilComposedChart
      animationType="none"
      config={CHART_CONFIG}
      curveType="linear"
      data={plot.values}
    >
      <Grid />
      <XAxis
        allowDecimals={false}
        dataKey="x"
        domain={["dataMin", "dataMax"]}
        tickFormatter={formatNumber}
        type="number"
      />
      <YAxis dataKey="y" tickFormatter={formatNumber} type="number" />
      <ChartTooltip content={<ChartTooltipContent />} />
      {plot.curve.length > 0 ? (
        <Line
          dataKey="y"
          lineProps={{
            activeDot: false,
            data: plot.curve,
            dot: false,
            legendType: "none",
            tooltipType: "none",
          }}
        />
      ) : null}
      <Scatter data={plot.values} dataKey="y" />
      <Legend verticalAlign="bottom" />
    </EvilComposedChart>
  );
}
