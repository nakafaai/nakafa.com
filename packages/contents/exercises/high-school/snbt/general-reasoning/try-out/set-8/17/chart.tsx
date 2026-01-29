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
  { year: "1", capital: 50, revenue: 150 },
  { year: "2", capital: 100, revenue: 200 },
  { year: "3", capital: 100, revenue: 250 },
  { year: "4", capital: 150, revenue: 250 },
  { year: "5", capital: 200, revenue: 300 },
];

interface Props {
  lang?: "id" | "en";
}

const translations = {
  id: {
    title: "Data Modal dan Pendapatan Toko A",
    description: "Modal dan Pendapatan (dalam juta) selama 5 tahun terakhir.",
    xAxisLabel: "Tahun ke-",
    capital: "Modal",
    revenue: "Pendapatan",
  },
  en: {
    title: "Store A Capital and Revenue Data",
    description: "Capital and Revenue (in millions) over the last 5 years.",
    xAxisLabel: "Year",
    capital: "Capital",
    revenue: "Revenue",
  },
};

export function ProfitChart({ lang = "en" }: Props) {
  const t = translations[lang];

  const chartConfig = {
    capital: {
      label: t.capital,
      color: "var(--chart-1)",
    },
    revenue: {
      label: t.revenue,
      color: "var(--chart-2)",
    },
  } satisfies ChartConfig;

  const formatYear = (value: string) => {
    switch (lang) {
      case "id":
        return `Tahun ke-${value}`;
      case "en":
        return `Year ${value}`;
      default:
        return `Year ${value}`;
    }
  };

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
              tickFormatter={formatYear}
              tickLine={false}
              tickMargin={10}
            />
            <YAxis axisLine={false} tickLine={false} tickMargin={10} />
            <ChartTooltip
              content={<ChartTooltipContent labelFormatter={formatYear} />}
            />
            <ChartLegend content={<ChartLegendContent />} />
            <RechartsBar
              dataKey="capital"
              fill={chartConfig.capital.color}
              radius={[4, 4, 0, 0]}
            />
            <RechartsBar
              dataKey="revenue"
              fill={chartConfig.revenue.color}
              radius={[4, 4, 0, 0]}
            />
          </RechartsBarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
