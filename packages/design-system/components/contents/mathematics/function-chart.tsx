"use client";

import type { ChartConfig } from "@repo/design-system/components/charts/chart";
import {
  ChartCartesianGrid,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartLine,
  ChartLineChart,
  ChartTooltip,
  ChartTooltipContent,
  ChartXAxis,
  ChartYAxis,
  getColorVariable,
} from "@repo/design-system/components/charts/chart";
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@repo/design-system/components/ui/frame";
import type { ReactNode } from "react";
import { useMemo } from "react";

const THRESHOLD_VALUE = 1000;
const THRESHOLD_VALUE_DECIMAL_PLACES = 0;
const FUNCTION_CHART_CONFIG = {
  y: {
    label: "f(x)",
    colors: { light: ["var(--chart-1)"] },
  },
} satisfies ChartConfig;

interface Props {
  a: number;
  description: ReactNode;
  n?: number;
  p: number;
  title: ReactNode;
}

export function FunctionChart({ p, a, title, description, n = 11 }: Props) {
  const data = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => {
        // Handle the specific case where a=0 and x=0 (mathematically undefined)
        if (a === 0 && i === 0) {
          return { x: i, y: null }; // Use null to represent undefined
        }
        return {
          x: i,
          y: p * a ** i,
        };
      }),
    [a, p, n]
  );

  return (
    <Frame>
      <FrameHeader>
        <FrameTitle>{title}</FrameTitle>
        <FrameDescription>{description}</FrameDescription>
      </FrameHeader>
      <FramePanel>
        <ChartContainer config={FUNCTION_CHART_CONFIG}>
          <ChartLineChart accessibilityLayer data={data}>
            <ChartCartesianGrid />
            <ChartXAxis
              dataKey="x"
              tickFormatter={(value) => value.toString()}
              tickMargin={8}
            />
            <ChartYAxis
              label={{
                value: "f(x)",
                angle: -90,
                position: "insideLeft",
                style: { textAnchor: "middle" },
              }}
              tickFormatter={(value) =>
                value >= THRESHOLD_VALUE
                  ? `${(value / THRESHOLD_VALUE).toFixed(THRESHOLD_VALUE_DECIMAL_PLACES)}k`
                  : String(value)
              }
              tickMargin={8}
            />
            <ChartTooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length > 0) {
                  const xValue = payload[0].payload.x;
                  const yValue = payload[0].payload.y;

                  // Special handling for undefined case
                  if (yValue === null) {
                    return (
                      <ChartTooltipContent
                        active={active}
                        label={`x = ${xValue}, y = undefined`}
                        payload={[]}
                      />
                    );
                  }

                  return (
                    <ChartTooltipContent
                      active={active}
                      label={`x = ${xValue}`}
                      payload={payload}
                    />
                  );
                }
                return null;
              }}
            />
            <ChartLine
              connectNulls={false}
              dataKey="y"
              dot
              name="y"
              stroke={getColorVariable("y", 0)}
              strokeWidth={2}
              type="monotone"
            />
            <ChartLegend
              content={<ChartLegendContent verticalAlign="bottom" />}
            />
          </ChartLineChart>
        </ChartContainer>
      </FramePanel>
    </Frame>
  );
}
