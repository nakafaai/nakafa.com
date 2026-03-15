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
  { month: "Jan-19", A: 27, B: 19.7, C: 11.8, D: 20.7 },
  { month: "Feb-19", A: 31.8, B: 23.2, C: 14.9, D: 10.8 },
  { month: "Mar-19", A: 26.9, B: 21.5, C: 17, D: 16.8 },
];

interface Props {
  lang?: "id" | "en";
}

const translations = {
  id: {
    title: "5 Top Perusahaan Smartphone",
    description:
      "Jumlah pengguna smartphone dari perusahaan A, B, C, dan D (dalam ratus ribuan).",
    yAxisLabel: "Jumlah Pengguna (Ratus Ribuan)",
  },
  en: {
    title: "Top 5 Smartphone Companies",
    description:
      "Number of smartphone users from companies A, B, C, and D (in hundred thousands).",
    yAxisLabel: "Number of Users (Hundred Thousands)",
  },
};

export function SalesChart({ lang = "en" }: Props) {
  const t = translations[lang];

  const chartConfig = {
    A: {
      label: "A",
      color: "var(--chart-1)",
    },
    B: {
      label: "B",
      color: "var(--chart-2)",
    },
    C: {
      label: "C",
      color: "var(--chart-3)",
    },
    D: {
      label: "D",
      color: "var(--chart-4)",
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
              dataKey="month"
              tickLine={false}
              tickMargin={10}
            />
            <YAxis
              axisLine={false}
              label={{
                value: t.yAxisLabel,
                angle: -90,
                position: "insideLeft",
                offset: 10,
                style: { textAnchor: "middle" },
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
