"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@repo/design-system/components/ui/chart";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts";

const chartData = [
  { year: "2013", growth: 5.58, barValue: 5.58 },
  { year: "2014", growth: 5.01, barValue: null },
  { year: "2015", growth: 4.88, barValue: 4.88 },
  { year: "2016", growth: 5.03, barValue: null },
  { year: "2017", growth: 5.07, barValue: 5.07 },
  { year: "2018", growth: 5.17, barValue: null },
];

interface Props {
  lang?: "id" | "en";
}

const translations = {
  id: {
    title: "Pertumbuhan Ekonomi Indonesia 2013—2018",
    description: "Nilai pertumbuhan PDB Tahunan (%).",
    yAxisLabel: "Pertumbuhan (%)",
  },
  en: {
    title: "Indonesia's Economic Growth 2013—2018",
    description: "Annual GDP Growth Value (%).",
    yAxisLabel: "Growth (%)",
  },
};

export function GrowthChart({ lang = "en" }: Props) {
  const t = translations[lang];

  const chartConfig = {
    growth: {
      label: t.yAxisLabel,
      color: "var(--chart-1)",
    },
  } satisfies ChartConfig;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer className="aspect-video" config={chartConfig}>
          <ComposedChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="year"
              tickLine={false}
              tickMargin={10}
            />
            <YAxis
              axisLine={false}
              domain={[4, 6]}
              tickCount={6}
              tickLine={false}
              tickMargin={10}
            />
            <ChartTooltip
              content={({ content, ...props }) => (
                <ChartTooltipContent
                  {...props}
                  payload={props.payload?.filter(
                    (item) => item.dataKey !== "barValue"
                  )}
                />
              )}
            />
            <Bar
              barSize={40}
              dataKey="barValue"
              fill="var(--chart-2)"
              radius={[4, 4, 0, 0]}
            />
            <Line
              activeDot={{
                r: 6,
              }}
              dataKey="growth"
              dot={{
                r: 4,
                fill: "var(--chart-1)",
              }}
              stroke="var(--chart-1)"
              strokeWidth={2}
              type="linear"
            />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
