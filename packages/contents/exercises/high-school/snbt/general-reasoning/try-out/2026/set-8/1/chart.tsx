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
  { year: "1", A: 260, B: 250, C: 225 },
  { year: "2", A: 390, B: 275, C: 280 },
  { year: "3", A: 425, B: 350, C: 320 },
  { year: "4", A: 450, B: 385, C: 400 },
  { year: "5", A: 520, B: 450, C: 495 },
];

interface Props {
  lang?: "id" | "en";
}

const translations = {
  id: {
    title: "Data Penjualan Toko Bunga",
    description:
      "Pendapatan tiga toko bunga di wilayah X selama lima tahun terakhir.",
    yAxisLabel: "Pendapatan",
  },
  en: {
    title: "Flower Shop Sales Data",
    description:
      "Sales revenue of three flower shops in region X over the last five years.",
    yAxisLabel: "Revenue",
  },
};

export function SalesChart({ lang = "en" }: Props) {
  const t = translations[lang];

  const chartConfig = {
    A: {
      label: "A",
      colors: { light: ["var(--chart-1)"] },
    },
    B: {
      label: "B",
      colors: { light: ["var(--chart-2)"] },
    },
    C: {
      label: "C",
      colors: { light: ["var(--chart-3)"] },
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
    <Card className="content-auto-card">
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
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => formatYear(String(value))}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            {Object.keys(chartConfig).map((key) => (
              <RechartsBar
                dataKey={key}
                fill={`var(--color-${key}-0)`}
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
