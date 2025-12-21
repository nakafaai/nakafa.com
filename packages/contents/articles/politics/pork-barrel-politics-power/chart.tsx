"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { format } from "date-fns";
import { useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";

interface Props {
  title: string;
  description: string;
  footnote: string;
  yLabel: string;
}

const BudgetChartData = [
  {
    year: "2020",
    budget: 498,
  },
  {
    year: "2021",
    budget: 468.2,
  },
  {
    year: "2022",
    budget: 460.6,
  },
  {
    year: "2023",
    budget: 439.1,
  },
  {
    year: "2024",
    budget: 496.8,
  },
];

export function BudgetChart({
  title,
  yLabel,
  footnote,
}: Omit<Props, "description">) {
  const t = useTranslations("Common");

  const chartConfig = {
    budget: {
      label: t("budget"),
      color: "var(--chart-4)",
    },
    label: {
      color: "var(--foreground)",
    },
  } satisfies ChartConfig;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Kemenkeu RI, 2024a.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <BarChart
            accessibilityLayer
            data={BudgetChartData}
            margin={{
              right: 16,
            }}
          >
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
                value: yLabel,
                angle: -90,
                position: "insideLeft",
                style: { textAnchor: "middle" },
              }}
              tickLine={false}
            />
            <ChartTooltip
              content={<ChartTooltipContent indicator="line" />}
              cursor={false}
            />
            <Bar dataKey="budget" fill="var(--color-budget)" radius={8}>
              <LabelList
                className="fill-foreground"
                dataKey="budget"
                fontSize={12}
                offset={8}
                position="top"
              />
            </Bar>
            <ChartLegend content={<ChartLegendContent />} />
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <p className="text-sm">{footnote}</p>
      </CardFooter>
    </Card>
  );
}

const FundChartData = [
  {
    year: "2015",
    fund: 16.7,
  },
  {
    year: "2016",
    fund: 9.3,
  },
  {
    year: "2017",
    fund: 13.1,
  },
  {
    year: "2018",
    fund: 17.6,
  },
];

export function FundChart({ title, description, yLabel, footnote }: Props) {
  const t = useTranslations("Common");

  const chartConfig = {
    fund: {
      label: t("fund"),
      color: "var(--chart-5)",
    },
    label: {
      color: "var(--foreground)",
    },
  } satisfies ChartConfig;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <BarChart
            accessibilityLayer
            data={FundChartData}
            margin={{
              right: 16,
            }}
          >
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
                value: yLabel,
                angle: -90,
                position: "insideLeft",
                style: { textAnchor: "middle" },
              }}
              tickLine={false}
            />
            <ChartTooltip
              content={<ChartTooltipContent indicator="line" />}
              cursor={false}
            />
            <Bar dataKey="fund" fill="var(--color-fund)" radius={8}>
              <LabelList
                className="fill-foreground"
                dataKey="fund"
                fontSize={12}
                offset={8}
                position="top"
              />
            </Bar>
            <ChartLegend content={<ChartLegendContent />} />
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <p className="text-sm">{footnote}</p>
      </CardFooter>
    </Card>
  );
}

const ElectabilityChartData = [
  {
    date: "2021-01-01",
    anies_muhaimin: 23,
    prabowo_gibran: 35,
    ganjar_mahfud: 25,
  },
  {
    date: "2022-05-01",
    anies_muhaimin: 22,
    prabowo_gibran: 33,
    ganjar_mahfud: 33,
  },
  {
    date: "2022-06-01",
    anies_muhaimin: 21,
    prabowo_gibran: 34,
    ganjar_mahfud: 38,
  },
  {
    date: "2022-07-01",
    anies_muhaimin: 28,
    prabowo_gibran: 27,
    ganjar_mahfud: 30,
  },
  {
    date: "2022-10-01",
    anies_muhaimin: 28,
    prabowo_gibran: 30,
    ganjar_mahfud: 32,
  },
  {
    date: "2023-01-01",
    anies_muhaimin: 22,
    prabowo_gibran: 22,
    ganjar_mahfud: 38,
  },
  {
    date: "2023-02-01",
    anies_muhaimin: 25,
    prabowo_gibran: 28,
    ganjar_mahfud: 37,
  },
  {
    date: "2023-04-01",
    anies_muhaimin: 28,
    prabowo_gibran: 35,
    ganjar_mahfud: 36,
  },
  {
    date: "2023-07-01",
    anies_muhaimin: 20,
    prabowo_gibran: 38,
    ganjar_mahfud: 32,
  },
  {
    date: "2023-09-01",
    anies_muhaimin: 21,
    prabowo_gibran: 37,
    ganjar_mahfud: 31,
  },
  {
    date: "2023-10-01",
    anies_muhaimin: 22,
    prabowo_gibran: 39,
    ganjar_mahfud: 37,
  },
  {
    date: "2023-12-01",
    anies_muhaimin: 20,
    prabowo_gibran: 43,
    ganjar_mahfud: 21,
  },
  {
    date: "2024-01-01",
    anies_muhaimin: 22,
    prabowo_gibran: 48,
    ganjar_mahfud: 19,
  },
  {
    date: "2024-02-01",
    anies_muhaimin: 22,
    prabowo_gibran: 56,
    ganjar_mahfud: 18,
  },
];

const chartConfig = {
  anies_muhaimin: {
    label: "Anies Baswedan-Muhaimin Iskandar",
    color: "var(--chart-1)",
  },
  prabowo_gibran: {
    label: "Prabowo Subianto-Gibran Rakabuming",
    color: "var(--chart-2)",
  },
  ganjar_mahfud: {
    label: "Ganjar Pranowo-Mahfud MD",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

export function ElectabilityChart({
  title,
  description,
  yLabel,
  footnote,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <LineChart accessibilityLayer data={ElectabilityChartData}>
            <CartesianGrid vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="date"
              tickFormatter={(value) => {
                const date = new Date(value);
                return format(date, "MMM yyyy");
              }}
              tickLine={false}
              tickMargin={8}
            />
            <YAxis
              axisLine={false}
              label={{
                value: yLabel,
                angle: -90,
                position: "insideLeft",
                style: { textAnchor: "middle" },
              }}
              tickLine={false}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  indicator="line"
                  labelFormatter={(value) =>
                    format(new Date(value), "MMMM yyyy")
                  }
                />
              }
              cursor={false}
            />
            <Line
              dataKey="anies_muhaimin"
              dot={false}
              stroke="var(--color-anies_muhaimin)"
              strokeWidth={2}
              type="natural"
            />
            <Line
              dataKey="prabowo_gibran"
              dot={false}
              stroke="var(--color-prabowo_gibran)"
              strokeWidth={2}
              type="natural"
            />
            <Line
              dataKey="ganjar_mahfud"
              dot={false}
              stroke="var(--color-ganjar_mahfud)"
              strokeWidth={2}
              type="natural"
            />
            <ChartLegend content={<ChartLegendContent />} />
          </LineChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <p className="text-sm">{footnote}</p>
      </CardFooter>
    </Card>
  );
}
