"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { ChartContainer } from "@repo/design-system/components/ui/chart";
import {
  CartesianGrid,
  Label,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

interface Props {
  title: string;
  description: string;
}

export function Graph({ title, description }: Props) {
  // Generate data points for y = sin(2x + 60°)
  const data = Array.from({ length: 200 }, (_, i) => {
    const x = (i / 199) * 200;
    const xRad = (x * Math.PI) / 180;
    const y = Math.sin(2 * xRad + (60 * Math.PI) / 180);
    return { x, y };
  });

  const chartConfig = {
    y: {
      label: "y",
      color: "var(--chart-1)",
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="x"
              domain={[0, 200]}
              tickFormatter={(value) => `${value}°`}
              ticks={[0, 15, 60, 150, 195]}
              type="number"
            />
            <YAxis
              domain={[-1.2, 1.2]}
              label={{
                value: "y",
                position: "insideLeft",
                style: { textAnchor: "middle" },
              }}
              ticks={[-1, 0, 1]}
              type="number"
            />
            <ReferenceLine stroke="transparent" y={0.866}>
              <Label
                offset={10}
                position="left"
                style={{ fill: "var(--muted-foreground)" }}
                value="1/2√3"
              />
            </ReferenceLine>
            <ReferenceLine
              stroke="var(--muted-foreground)"
              strokeDasharray="3 3"
              y={1}
            />
            <ReferenceLine stroke="var(--muted-foreground)" y={0} />
            <ReferenceLine
              stroke="var(--muted-foreground)"
              strokeDasharray="3 3"
              y={-1}
            />
            <ReferenceLine
              stroke="var(--muted-foreground)"
              strokeDasharray="3 3"
              x={0}
            />
            <ReferenceLine
              stroke="var(--muted-foreground)"
              strokeDasharray="3 3"
              x={15}
            />
            <ReferenceLine
              stroke="var(--muted-foreground)"
              strokeDasharray="3 3"
              x={195}
            />
            <Line
              dataKey="y"
              dot={false}
              stroke="var(--color-y)"
              strokeWidth={2}
              type="monotone"
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
