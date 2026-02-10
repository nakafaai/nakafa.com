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
  { class: "A", passed: 15, failed: 5 },
  { class: "B", passed: 20, failed: 10 },
  { class: "C", passed: 24, failed: 6 },
  { class: "D", passed: 30, failed: 20 },
  { class: "E", passed: 25, failed: 15 },
];

interface Props {
  lang?: "id" | "en";
}

const translations = {
  id: {
    title: "Data Kelulusan Ujian Matematika",
    description:
      "Jumlah siswa yang lulus dan tidak lulus per kelas di SMAN 22 SUKASUSU.",
    passed: "Lulus",
    failed: "Tidak Lulus",
    classPrefix: "Kelas",
  },
  en: {
    title: "Mathematics Exam Passing Data",
    description:
      "Number of students who passed and failed per class at SMAN 22 SUKASUSU.",
    passed: "Passed",
    failed: "Failed",
    classPrefix: "Class",
  },
};

export function GraduationChart({ lang = "en" }: Props) {
  const t = translations[lang];

  // Transform data to include localized class names (e.g., "Kelas A" or "Class A")
  const data = chartData.map((item) => ({
    ...item,
    formattedClass: `${t.classPrefix} ${item.class}`,
  }));

  const chartConfig = {
    passed: {
      label: t.passed,
      color: "var(--chart-1)",
    },
    failed: {
      label: t.failed,
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
          <RechartsBarChart accessibilityLayer data={data}>
            <CartesianGrid vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="formattedClass"
              tickLine={false}
              tickMargin={10}
            />
            <YAxis axisLine={false} tickLine={false} tickMargin={10} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <RechartsBar
              dataKey="passed"
              fill="var(--color-passed)"
              radius={[4, 4, 0, 0]}
            />
            <RechartsBar
              dataKey="failed"
              fill="var(--color-failed)"
              radius={[4, 4, 0, 0]}
            />
          </RechartsBarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
