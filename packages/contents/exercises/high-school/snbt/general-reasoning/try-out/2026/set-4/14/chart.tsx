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
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@repo/design-system/components/ui/chart";
import {
  CartesianGrid,
  Bar as RechartsBar,
  BarChart as RechartsBarChart,
  XAxis,
  YAxis,
} from "recharts";

const chartData = [
  { year: "2017", mieA: 3500, mieB: 4500, mieC: 2250 },
  { year: "2018", mieA: 2500, mieB: 4250, mieC: 2500 },
  { year: "2019", mieA: 3350, mieB: 4000, mieC: 2800 },
  { year: "2020", mieA: 3000, mieB: 4500, mieC: 2650 },
];

interface Props {
  lang?: "id" | "en";
}

const translations = {
  id: {
    title: "Grafik Harga Mie Instan",
    description: "Data harga Mie A, Mie B, dan Mie C (2017-2020).",
    yAxisLabel: "Harga (Rp)",
    labels: {
      mieA: "Mie A",
      mieB: "Mie B",
      mieC: "Mie C",
    },
  },
  en: {
    title: "Instant Noodle Price Chart",
    description: "Price data for Noodle A, Noodle B, and Noodle C (2017-2020).",
    yAxisLabel: "Price (Rp)",
    labels: {
      mieA: "Noodle A",
      mieB: "Noodle B",
      mieC: "Noodle C",
    },
  },
};

export function PriceChart({ lang = "en" }: Props) {
  const t = translations[lang];

  const chartConfig = {
    mieA: {
      label: t.labels.mieA,
      color: "var(--chart-1)",
    },
    mieB: {
      label: t.labels.mieB,
      color: "var(--chart-2)",
    },
    mieC: {
      label: t.labels.mieC,
      color: "var(--chart-3)",
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
          <RechartsBarChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="year"
              tickLine={false}
              tickMargin={10}
            />
            <YAxis
              axisLine={false}
              label={{
                value: t.yAxisLabel,
                angle: -90,
                position: "insideLeft",
              }}
              tickFormatter={(value) => `${value / 1000}k`}
              tickLine={false}
              tickMargin={10}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            {Object.entries(chartConfig).map(([key, config]) => (
              <RechartsBar
                dataKey={key}
                fill={config.color}
                key={key}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </RechartsBarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
