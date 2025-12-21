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

interface Props {
  title: string;
  description: string;
  footnote: string;
}

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
      name: t("not-answering"),
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
              left: 81,
            }}
          >
            <CartesianGrid horizontal={false} />
            <YAxis
              axisLine={false}
              dataKey="name"
              hide
              tickLine={false}
              tickMargin={10}
              type="category"
            />
            <XAxis dataKey="value" hide type="number" />
            <ChartTooltip
              content={<ChartTooltipContent indicator="line" />}
              cursor={false}
            />
            <Bar
              dataKey="value"
              fill="var(--color-value)"
              layout="vertical"
              radius={8}
            >
              <LabelList
                className="fill-foreground"
                dataKey="name"
                fontSize={12}
                offset={10}
                position="left"
                width={75}
              />
              <LabelList
                className="fill-foreground"
                dataKey="value"
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
        <p className="text-sm">{footnote}</p>
      </CardFooter>
    </Card>
  );
}
