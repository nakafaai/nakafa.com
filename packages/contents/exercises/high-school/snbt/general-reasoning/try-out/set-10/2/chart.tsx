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
  { division: "A", rejected: 20, accepted: 30 },
  { division: "B", rejected: 30, accepted: 20 },
  { division: "C", rejected: 10, accepted: 50 },
  { division: "D", rejected: 30, accepted: 90 },
  { division: "E", rejected: 25, accepted: 50 },
];

interface Props {
  lang?: "id" | "en";
}

const translations = {
  id: {
    title: "Data Penerimaan Pegawai Perusahaan A",
    description:
      "Jumlah calon pegawai yang diterima dan tidak diterima per divisi di Perusahaan A.",
    accepted: "Diterima",
    rejected: "Tidak Diterima",
    divisionPrefix: "Divisi",
  },
  en: {
    title: "Company A Employee Recruitment Data",
    description:
      "Number of accepted and rejected employee candidates per division at Company A.",
    accepted: "Accepted",
    rejected: "Rejected",
    divisionPrefix: "Division",
  },
};

export function RecruitmentChart({ lang = "en" }: Props) {
  const t = translations[lang];

  // Transform data to include localized division names
  const data = chartData.map((item) => ({
    ...item,
    formattedDivision: `${t.divisionPrefix} ${item.division}`,
  }));

  const chartConfig = {
    rejected: {
      label: t.rejected,
      color: "var(--chart-1)",
    },
    accepted: {
      label: t.accepted,
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
              dataKey="formattedDivision"
              tickLine={false}
              tickMargin={10}
            />
            <YAxis axisLine={false} tickLine={false} tickMargin={10} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <RechartsBar
              dataKey="rejected"
              fill="var(--color-rejected)"
              radius={[4, 4, 0, 0]}
            />
            <RechartsBar
              dataKey="accepted"
              fill="var(--color-accepted)"
              radius={[4, 4, 0, 0]}
            />
          </RechartsBarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
