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
  { year: "2011", shirts: 50, pants: 60, suits: 40 },
  { year: "2012", shirts: 35, pants: 60, suits: 55 },
  { year: "2013", shirts: 20, pants: 50, suits: 45 },
  { year: "2014", shirts: 70, pants: 40, suits: 60 },
  { year: "2015", shirts: 55, pants: 40, suits: 50 },
];

interface Props {
  lang?: "id" | "en";
}

const translations = {
  id: {
    title: "Grafik Penjualan di Factory Outlet",
    description: "Data penjualan Baju, Celana, dan Jas (2011-2015).",
    yAxisLabel: "Penjualan",
    labels: {
      shirts: "Baju",
      pants: "Celana",
      suits: "Jas",
    },
  },
  en: {
    title: "Factory Outlet Sales Chart",
    description: "Sales data for Shirts, Pants, and Suits (2011-2015).",
    yAxisLabel: "Sales",
    labels: {
      shirts: "Shirts",
      pants: "Pants",
      suits: "Suits",
    },
  },
};

export function SalesChart({ lang = "en" }: Props) {
  const t = translations[lang];

  const chartConfig = {
    shirts: {
      label: t.labels.shirts,
      color: "var(--chart-1)",
    },
    pants: {
      label: t.labels.pants,
      color: "var(--chart-2)",
    },
    suits: {
      label: t.labels.suits,
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
