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
  { day: "Senin", library: 150, laboratory: 250 },
  { day: "Selasa", library: 135, laboratory: 210 },
  { day: "Rabu", library: 100, laboratory: 140 },
  { day: "Kamis", library: 140, laboratory: 170 },
  { day: "Jumat", library: 165, laboratory: 120 },
];

interface Props {
  lang?: "id" | "en";
}

const translations = {
  id: {
    title: "Data Pengunjung Fasilitas SMA MMM",
    description:
      "Jumlah pengunjung Perpustakaan dan Laboratorium (Senin - Jumat).",
    yAxisLabel: "Jumlah Pengunjung",
    library: "Perpustakaan",
    laboratory: "Laboratorium",
  },
  en: {
    title: "SMA MMM Facility Visitor Data",
    description:
      "Number of visitors for Library and Laboratory (Monday - Friday).",
    yAxisLabel: "Number of Visitors",
    library: "Library",
    laboratory: "Laboratory",
  },
};

export function VisitorChart({ lang = "id" }: Props) {
  const t = translations[lang];

  const chartConfig = {
    library: {
      label: t.library,
      color: "var(--chart-1)",
    },
    laboratory: {
      label: t.laboratory,
      color: "var(--chart-2)",
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
          <RechartsLineChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="day"
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
            <RechartsLine
              dataKey="library"
              dot={{ r: 4 }}
              stroke="var(--color-library)"
              strokeWidth={2}
            />
            <RechartsLine
              dataKey="laboratory"
              dot={{ r: 4 }}
              stroke="var(--color-laboratory)"
              strokeWidth={2}
            />
          </RechartsLineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
