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
  Line as RechartsLine,
  LineChart as RechartsLineChart,
  XAxis,
  YAxis,
} from "recharts";

const chartData = [
  { month: "Januari", grainPrice: 5353, governmentPrice: 3700 },
  { month: "Februari", grainPrice: 5114, governmentPrice: 3700 },
  { month: "Maret", grainPrice: 4604, governmentPrice: 3700 },
  { month: "April", grainPrice: 4357, governmentPrice: 3700 },
] as const;

interface Props {
  lang?: "id" | "en";
}

const translations = {
  id: {
    title: "Harga Gabah di Tingkat Petani 2019",
    description:
      "Perbandingan Harga Gabah dan Harga Pembelian Pemerintah (Jan-Apr 2019).",
    yAxisLabel: "Harga (Rp/kg)",
    labels: {
      grainPrice: "Harga Gabah",
      governmentPrice: "Harga Pembelian Pemerintah",
    },
    months: {
      Januari: "Januari",
      Februari: "Februari",
      Maret: "Maret",
      April: "April",
    },
  },
  en: {
    title: "Grain Price at Farmer Level 2019",
    description:
      "Comparison of Grain Price and Government Purchase Price (Jan-Apr 2019).",
    yAxisLabel: "Price (Rp/kg)",
    labels: {
      grainPrice: "Grain Price",
      governmentPrice: "Government Purchase Price",
    },
    months: {
      Januari: "January",
      Februari: "February",
      Maret: "March",
      April: "April",
    },
  },
} as const;

export function SalesChart({ lang = "en" }: Props) {
  const t = translations[lang];

  const chartConfig = {
    grainPrice: {
      label: t.labels.grainPrice,
      color: "var(--chart-1)",
    },
    governmentPrice: {
      label: t.labels.governmentPrice,
      color: "var(--chart-2)",
    },
  } satisfies ChartConfig;

  const translatedData = chartData.map((item) => ({
    ...item,
    month: t.months[item.month],
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer className="aspect-video" config={chartConfig}>
          <RechartsLineChart accessibilityLayer data={translatedData}>
            <CartesianGrid vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="month"
              tickLine={false}
              tickMargin={10}
            />
            <YAxis
              axisLine={false}
              domain={[3000, 6000]}
              label={{
                value: t.yAxisLabel,
                angle: -90,
                position: "insideLeft",
                offset: 0,
              }}
              tickFormatter={(value) => `${value / 1000}k`}
              tickLine={false}
              tickMargin={10}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <RechartsLine
              dataKey="grainPrice"
              dot={{ r: 4 }}
              stroke={chartConfig.grainPrice.color}
              strokeWidth={2}
              type="monotone"
            />
            <RechartsLine
              dataKey="governmentPrice"
              dot={{ r: 4 }}
              stroke={chartConfig.governmentPrice.color}
              strokeWidth={2}
              type="monotone"
            />
          </RechartsLineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
