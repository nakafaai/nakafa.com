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
import { useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  XAxis,
  YAxis,
} from "recharts";

type Props = {
  title: string;
  description: string;
  footnote: string;
};

const CabinetChartData = [
  { name: "Reformasi Pembangunan", cabinet: 37 },
  { name: "Persatuan Nasional", cabinet: 36 },
  { name: "Gotong Royong", cabinet: 33 },
  { name: "Indonesia Bersatu", cabinet: 34 },
  { name: "Indonesia Bersatu II", cabinet: 34 },
  { name: "Kerja", cabinet: 34 },
  { name: "Indonesia Maju", cabinet: 34 },
  { name: "Merah Putih", cabinet: 48 },
];

export function CabinetChart({ title, description, footnote }: Props) {
  const t = useTranslations("Common");

  const chartConfig = {
    cabinet: {
      label: t("cabinet"),
      color: "var(--chart-1)",
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
            data={CabinetChartData}
            layout="vertical"
            margin={{
              right: 16,
            }}
          >
            <CartesianGrid horizontal={false} />
            <YAxis
              axisLine={false}
              dataKey="name"
              hide
              tickFormatter={(value) => value.slice(0, 3)}
              tickLine={false}
              tickMargin={10}
              type="category"
            />
            <XAxis dataKey="cabinet" hide type="number" />
            <ChartTooltip
              content={<ChartTooltipContent indicator="line" />}
              cursor={false}
            />
            <Bar
              dataKey="cabinet"
              fill="var(--color-cabinet)"
              layout="vertical"
              radius={8}
            >
              <LabelList
                className="fill-(--color-label)"
                dataKey="name"
                fontSize={12}
                offset={8}
                position="insideLeft"
              />
              <LabelList
                className="fill-foreground"
                dataKey="cabinet"
                fontSize={12}
                offset={8}
                position="right"
              />
            </Bar>
            <ChartLegend content={<ChartLegendContent />} />
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <p className="text-foreground/80 text-sm">{footnote}</p>
      </CardFooter>
    </Card>
  );
}

export function CompositionChart({ title, description, footnote }: Props) {
  const t = useTranslations("Common");

  const MinisterChartData = [{ name: t("minister"), new: 31, incumbent: 18 }];
  const GenderChartData = [{ name: t("gender"), male: 43, female: 5 }];
  const PoliticalStatusChartData = [
    { name: t("political-status"), politician: 23, non_politician: 25 },
  ];

  const chartConfig = {
    new: {
      label: t("new"),
      color: "var(--chart-1)",
    },
    incumbent: {
      label: t("incumbent"),
      color: "var(--chart-2)",
    },
    male: {
      label: t("male"),
      color: "var(--chart-1)",
    },
    female: {
      label: t("female"),
      color: "var(--chart-2)",
    },
    politician: {
      label: t("politicians"),
      color: "var(--chart-1)",
    },
    non_politician: {
      label: t("non-politicians"),
      color: "var(--chart-2)",
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
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ChartContainer
            className="aspect-square sm:aspect-square"
            config={chartConfig}
          >
            <BarChart accessibilityLayer data={MinisterChartData}>
              <CartesianGrid vertical={false} />
              <XAxis
                axisLine={false}
                dataKey="name"
                tickLine={false}
                tickMargin={10}
              />
              <ChartTooltip
                content={<ChartTooltipContent indicator="line" />}
                cursor={false}
              />
              <Bar dataKey="new" fill="var(--color-new)" radius={8} />
              <Bar
                dataKey="incumbent"
                fill="var(--color-incumbent)"
                radius={8}
              />
              <ChartLegend content={<ChartLegendContent />} />
            </BarChart>
          </ChartContainer>

          <ChartContainer
            className="aspect-square sm:aspect-square"
            config={chartConfig}
          >
            <BarChart data={GenderChartData}>
              <CartesianGrid vertical={false} />
              <XAxis
                axisLine={false}
                dataKey="name"
                tickLine={false}
                tickMargin={10}
              />
              <ChartTooltip
                content={<ChartTooltipContent indicator="line" />}
                cursor={false}
              />
              <Bar dataKey="male" fill="var(--color-male)" radius={8} />
              <Bar dataKey="female" fill="var(--color-female)" radius={8} />
              <ChartLegend content={<ChartLegendContent />} />
            </BarChart>
          </ChartContainer>

          <ChartContainer
            className="aspect-square sm:aspect-square"
            config={chartConfig}
          >
            <BarChart data={PoliticalStatusChartData}>
              <CartesianGrid vertical={false} />
              <XAxis
                axisLine={false}
                dataKey="name"
                tickLine={false}
                tickMargin={10}
              />
              <ChartTooltip
                content={<ChartTooltipContent indicator="line" />}
                cursor={false}
              />
              <Bar
                dataKey="politician"
                fill="var(--color-politician)"
                radius={8}
              />
              <Bar
                dataKey="non_politician"
                fill="var(--color-non_politician)"
                radius={8}
              />
              <ChartLegend content={<ChartLegendContent />} />
            </BarChart>
          </ChartContainer>
        </div>
      </CardContent>
      <CardFooter>
        <p className="text-foreground/80 text-sm">{footnote}</p>
      </CardFooter>
    </Card>
  );
}
