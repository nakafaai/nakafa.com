"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useTranslations } from "next-intl";
import { LabelList } from "recharts";
import { Bar } from "recharts";
import { BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

type Props = {
  title: string;
  description: string;
  footnote: string;
};

export function ElectabilityChart({ title, description, footnote }: Props) {
  const t = useTranslations("Common");

  const electabilityData = [
    {
      name: "Anies Baswedan",
      value: 40,
    },
    {
      name: "Basuki Tjahaja Purnama",
      value: 24,
    },
    {
      name: "Ridwan Kamil",
      value: 13,
    },
    {
      name: "Tri Rismaharini",
      value: 1,
    },
    {
      name: "Erick Tohir",
      value: 1,
    },
    {
      name: "Erwin Aksa",
      value: 1,
    },
    {
      name: "Ahmad Sahroni",
      value: 1,
    },
    {
      name: t("electability"),
      value: 16,
    },
  ];

  const chartConfig = {
    value: {
      label: t("electability"),
      color: "var(--chart-3)",
    },
    label: {
      color: "var(--background)",
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
            data={electabilityData}
            layout="vertical"
            margin={{
              right: 24,
              left: 76,
            }}
          >
            <CartesianGrid horizontal={false} />
            <YAxis
              dataKey="name"
              type="category"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              hide
            />
            <XAxis dataKey="value" type="number" hide />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="line" />}
            />
            <Bar
              dataKey="value"
              layout="vertical"
              fill="var(--color-value)"
              radius={8}
            >
              <LabelList
                dataKey="name"
                position="left"
                offset={8}
                className="fill-foreground"
                fontSize={12}
                formatter={(value: string) => value.split(" ")[0]}
              />
              <LabelList
                dataKey="value"
                position="right"
                offset={8}
                className="fill-foreground"
                fontSize={12}
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
