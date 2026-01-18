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
  { month: "Agust-20", garlic: 58, shallot: 48, chili: 54 },
  { month: "Sep-20", garlic: 61, shallot: 54, chili: 58 },
  { month: "Okt-20", garlic: 67, shallot: 60, chili: 62 },
  { month: "Nop-20", garlic: 76, shallot: 66, chili: 68 },
  { month: "Des-20", garlic: 88, shallot: 72, chili: 72 },
];

interface Props {
  lang?: "id" | "en";
}

const translations = {
  id: {
    title: "Penjualan Jenis Rempah",
    description:
      "Data penjualan Bawang Putih, Bawang Merah, dan Cabai Merah (Agust-Des 2020).",
    yAxisLabel: "Penjualan (ton)",
    labels: {
      garlic: "Bawang Putih",
      shallot: "Bawang Merah",
      chili: "Cabai Merah",
    },
  },
  en: {
    title: "Spice Sales",
    description:
      "Sales data for Garlic, Shallot, and Red Chili (Aug-Dec 2020).",
    yAxisLabel: "Sales (tons)",
    labels: {
      garlic: "Garlic",
      shallot: "Shallot",
      chili: "Red Chili",
    },
  },
};

export function SpiceSalesChart({ lang = "en" }: Props) {
  const t = translations[lang];

  const chartConfig = {
    garlic: {
      label: t.labels.garlic,
      color: "var(--chart-1)",
    },
    shallot: {
      label: t.labels.shallot,
      color: "var(--chart-2)",
    },
    chili: {
      label: t.labels.chili,
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
