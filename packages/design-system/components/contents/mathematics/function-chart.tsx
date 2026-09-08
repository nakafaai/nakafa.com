"use client";

import {
  type Exponential,
  resolveExponential,
} from "@repo/design-system/components/contents/mathematics/exponential";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { Effect } from "effect";
import { useFormatter } from "next-intl";
import { type ReactNode, useMemo } from "react";

const CHART_CONFIG = {
  y: {
    label: <InlineMath math="f(x)" />,
    colors: { light: ["var(--chart-1)"], dark: ["var(--chart-1)"] },
  },
} satisfies ChartConfig;

const DECIMAL_OR_GROUP_SEPARATOR = /[,.]/gu;

function numberMath(value: number, format: (value: number) => string) {
  const rounded = Number(value.toPrecision(10));
  const text = format(rounded).replace(DECIMAL_OR_GROUP_SEPARATOR, "{$&}");
  return `${rounded === value ? "" : "\\approx"}${text}`;
}

/** Composes an exact model curve, discrete observations, and accessible values. */
export function FunctionChart({
  a,
  p,
  n,
  mode,
  title,
  description,
}: Exponential & { title: ReactNode; description: ReactNode }) {
  const formatter = useFormatter();
  const formatNumber = (value: number) =>
    formatter.number(value, {
      maximumSignificantDigits: 10,
    });
  const coefficientMath = (value: number) =>
    formatter
      .number(value, { maximumSignificantDigits: 21, useGrouping: false })
      .replace(DECIMAL_OR_GROUP_SEPARATOR, "{$&}");
  const plot = useMemo(
    () => Effect.runSync(resolveExponential({ a, p, n, mode })),
    [a, p, n, mode]
  );

  return (
    <Card className="content-auto-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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
        <Table>
          <TableCaption>
            <InlineMath
              math={`f(x)=${coefficientMath(p)}\\cdot(${coefficientMath(a)})^x`}
            />
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">
                <InlineMath math="x" />
              </TableHead>
              {plot.values.map(({ x }) => (
                <TableHead key={x} scope="col">
                  <InlineMath math={String(x)} />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableHead scope="row">
                <InlineMath math="f(x)" />
              </TableHead>
              {plot.values.map(({ x, y }) => (
                <TableCell key={x}>
                  <InlineMath math={numberMath(y, formatNumber)} />
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
