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
  ChartBar,
  ChartBarChart,
  ChartCartesianGrid,
  type ChartConfig,
  ChartContainer,
  ChartLabelList,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  ChartXAxis,
  ChartYAxis,
} from "@repo/design-system/components/ui/chart";
import type { ReactNode } from "react";

const TICK_LABEL_CHAR_LIMIT = 3;

interface SharedProps {
  description: ReactNode;
  footnote: ReactNode;
  title: ReactNode;
}

interface CabinetChartProps extends SharedProps {
  labels: {
    cabinet: ReactNode;
  };
}

interface CompositionChartProps extends SharedProps {
  labels: {
    female: ReactNode;
    gender: string;
    incumbent: ReactNode;
    male: ReactNode;
    minister: string;
    new: ReactNode;
    nonPoliticians: ReactNode;
    politicalStatus: string;
    politicians: ReactNode;
  };
}

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

export function CabinetChart({
  title,
  description,
  footnote,
  labels,
}: CabinetChartProps) {
  const chartConfig = {
    cabinet: {
      label: labels.cabinet,
      colors: { light: ["var(--chart-1)"] },
    },
    label: {
      colors: { light: ["var(--foreground)"] },
    },
  } satisfies ChartConfig;

  return (
    <Card className="content-auto-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <ChartBarChart
            accessibilityLayer
            data={CabinetChartData}
            layout="vertical"
            margin={{
              right: 16,
            }}
          >
            <ChartCartesianGrid horizontal={false} />
            <ChartYAxis
              axisLine={false}
              dataKey="name"
              hide
              tickFormatter={(value) => value.slice(0, TICK_LABEL_CHAR_LIMIT)}
              tickLine={false}
              tickMargin={10}
              type="category"
            />
            <ChartXAxis dataKey="cabinet" hide type="number" />
            <ChartTooltip
              content={<ChartTooltipContent indicator="line" />}
              cursor={false}
            />
            <ChartBar
              dataKey="cabinet"
              fill="var(--color-cabinet-0)"
              radius={8}
            >
              <ChartLabelList
                className="fill-(--color-label)"
                dataKey="name"
                fontSize={12}
                offset={8}
                position="insideLeft"
              />
              <ChartLabelList
                className="fill-foreground"
                dataKey="cabinet"
                fontSize={12}
                offset={8}
                position="right"
              />
            </ChartBar>
            <ChartLegend content={<ChartLegendContent />} />
          </ChartBarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <p className="text-sm">{footnote}</p>
      </CardFooter>
    </Card>
  );
}

export function CompositionChart({
  title,
  description,
  footnote,
  labels,
}: CompositionChartProps) {
  const MinisterChartData = [{ name: labels.minister, new: 31, incumbent: 18 }];
  const GenderChartData = [{ name: labels.gender, male: 43, female: 5 }];
  const PoliticalStatusChartData = [
    {
      name: labels.politicalStatus,
      politician: 23,
      non_politician: 25,
    },
  ];

  const chartConfig = {
    new: {
      label: labels.new,
      colors: { light: ["var(--chart-1)"] },
    },
    incumbent: {
      label: labels.incumbent,
      colors: { light: ["var(--chart-2)"] },
    },
    male: {
      label: labels.male,
      colors: { light: ["var(--chart-1)"] },
    },
    female: {
      label: labels.female,
      colors: { light: ["var(--chart-2)"] },
    },
    politician: {
      label: labels.politicians,
      colors: { light: ["var(--chart-1)"] },
    },
    non_politician: {
      label: labels.nonPoliticians,
      colors: { light: ["var(--chart-2)"] },
    },
    label: {
      colors: { light: ["var(--foreground)"] },
    },
  } satisfies ChartConfig;

  return (
    <Card className="content-auto-card">
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
            <ChartBarChart accessibilityLayer data={MinisterChartData}>
              <ChartCartesianGrid vertical={false} />
              <ChartXAxis
                axisLine={false}
                dataKey="name"
                tickLine={false}
                tickMargin={10}
              />
              <ChartTooltip
                content={<ChartTooltipContent indicator="line" />}
                cursor={false}
              />
              <ChartBar dataKey="new" fill="var(--color-new-0)" radius={8} />
              <ChartBar
                dataKey="incumbent"
                fill="var(--color-incumbent-0)"
                radius={8}
              />
              <ChartLegend content={<ChartLegendContent />} />
            </ChartBarChart>
          </ChartContainer>

          <ChartContainer
            className="aspect-square sm:aspect-square"
            config={chartConfig}
          >
            <ChartBarChart data={GenderChartData}>
              <ChartCartesianGrid vertical={false} />
              <ChartXAxis
                axisLine={false}
                dataKey="name"
                tickLine={false}
                tickMargin={10}
              />
              <ChartTooltip
                content={<ChartTooltipContent indicator="line" />}
                cursor={false}
              />
              <ChartBar dataKey="male" fill="var(--color-male-0)" radius={8} />
              <ChartBar
                dataKey="female"
                fill="var(--color-female-0)"
                radius={8}
              />
              <ChartLegend content={<ChartLegendContent />} />
            </ChartBarChart>
          </ChartContainer>

          <ChartContainer
            className="aspect-square sm:aspect-square"
            config={chartConfig}
          >
            <ChartBarChart data={PoliticalStatusChartData}>
              <ChartCartesianGrid vertical={false} />
              <ChartXAxis
                axisLine={false}
                dataKey="name"
                tickLine={false}
                tickMargin={10}
              />
              <ChartTooltip
                content={<ChartTooltipContent indicator="line" />}
                cursor={false}
              />
              <ChartBar
                dataKey="politician"
                fill="var(--color-politician-0)"
                radius={8}
              />
              <ChartBar
                dataKey="non_politician"
                fill="var(--color-non_politician-0)"
                radius={8}
              />
              <ChartLegend content={<ChartLegendContent />} />
            </ChartBarChart>
          </ChartContainer>
        </div>
      </CardContent>
      <CardFooter>
        <p className="text-sm">{footnote}</p>
      </CardFooter>
    </Card>
  );
}
