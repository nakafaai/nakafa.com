"use client";

import {
  Bar,
  EvilBarChart,
  Grid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from "@repo/design-system/components/evilcharts/charts/bar-chart";
import type { ChartConfig } from "@repo/design-system/components/evilcharts/ui/chart-config";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import type { ReactNode } from "react";

const VALUE_AXIS_PADDING_RATIO = 0.12;
const VALUE_LABEL_MARGIN = 16;

interface Props {
  description: ReactNode;
  footnote: ReactNode;
  labels: {
    electability: ReactNode;
    notAnswering: string;
  };
  title: ReactNode;
}

/** Renders the candidate electability comparison used by the KIM Plus article. */
export function ElectabilityChart({
  title,
  description,
  footnote,
  labels,
}: Props) {
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
      name: labels.notAnswering,
      value: 16,
    },
  ];
  const maxValue = Math.max(...electabilityData.map(({ value }) => value));
  const valueAxisMax = Math.ceil(maxValue * (1 + VALUE_AXIS_PADDING_RATIO));

  const chartConfig = {
    value: {
      label: labels.electability,
      colors: { light: ["var(--chart-3)"], dark: ["var(--chart-3)"] },
    },
  } satisfies ChartConfig;

  return (
    <Card className="content-auto-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <EvilBarChart
          chartProps={{ margin: { right: VALUE_LABEL_MARGIN } }}
          config={chartConfig}
          data={electabilityData}
          layout="horizontal"
        >
          <Grid horizontal={false} />
          <YAxis dataKey="name" tickMargin={10} width={150} />
          <XAxis dataKey="value" domain={[0, valueAxisMax]} hide />
          <Tooltip />
          <Bar
            barProps={{ label: { position: "right", fontSize: 12 } }}
            dataKey="value"
            radius={8}
          />
          <Legend />
        </EvilBarChart>
      </CardContent>
      <CardFooter>
        <p className="text-sm">{footnote}</p>
      </CardFooter>
    </Card>
  );
}
