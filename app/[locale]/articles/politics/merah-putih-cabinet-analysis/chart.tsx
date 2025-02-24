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
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  XAxis,
  YAxis,
} from "recharts";

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

const CabinetChartConfig = {
  cabinet: {
    label: "Cabinet",
    color: "var(--chart-2)",
  },
  label: {
    color: "var(--background)",
  },
} satisfies ChartConfig;

export function CabinetChart({
  title,
  description,
}: { title: string; description: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={CabinetChartConfig}>
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
              dataKey="name"
              type="category"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => value.slice(0, 3)}
              hide
            />
            <XAxis dataKey="cabinet" type="number" hide />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="line" />}
            />
            <Bar
              dataKey="cabinet"
              layout="vertical"
              fill="var(--color-cabinet)"
              radius={8}
            >
              <LabelList
                dataKey="name"
                position="insideLeft"
                offset={8}
                className="fill-(--color-label)"
                fontSize={12}
              />
              <LabelList
                dataKey="cabinet"
                position="right"
                offset={8}
                className="fill-foreground"
                fontSize={12}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <p className="text-foreground/80 text-sm">
          The Merah Putih cabinet is the largest cabinet in Indonesia&apos;s
          history, with 48 ministers.
        </p>
      </CardFooter>
    </Card>
  );
}
