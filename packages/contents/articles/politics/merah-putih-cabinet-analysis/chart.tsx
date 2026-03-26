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
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  XAxis,
  YAxis,
} from "recharts";

const TICK_LABEL_CHAR_LIMIT = 3;

interface SharedProps {
  description: string;
  footnote: string;
  title: string;
}

interface CabinetChartProps extends SharedProps {
  labels: {
    cabinet: string;
  };
}

interface CompositionChartProps extends SharedProps {
  labels: {
    female: string;
    gender: string;
    incumbent: string;
    male: string;
    minister: string;
    new: string;
    nonPoliticians: string;
    politicalStatus: string;
    politicians: string;
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
              tickFormatter={(value) => value.slice(0, TICK_LABEL_CHAR_LIMIT)}
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
      color: "var(--chart-1)",
    },
    incumbent: {
      label: labels.incumbent,
      color: "var(--chart-2)",
    },
    male: {
      label: labels.male,
      color: "var(--chart-1)",
    },
    female: {
      label: labels.female,
      color: "var(--chart-2)",
    },
    politician: {
      label: labels.politicians,
      color: "var(--chart-1)",
    },
    non_politician: {
      label: labels.nonPoliticians,
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
        <p className="text-sm">{footnote}</p>
      </CardFooter>
    </Card>
  );
}
