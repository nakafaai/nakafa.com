"use client";

import {
  ChartCartesianGrid,
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartLine,
  ChartLineChart,
  ChartTooltip,
  ChartTooltipContent,
  ChartXAxis,
  ChartYAxis,
} from "@repo/design-system/components/charts/chart";
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@repo/design-system/components/ui/frame";
import { format } from "date-fns";
import type { ReactNode } from "react";

interface ElectabilityChartProps {
  description: ReactNode;
  footnote: ReactNode;
  labels: {
    aniesMuhaimin: ReactNode;
    ganjarMahfud: ReactNode;
    prabowoGibran: ReactNode;
  };
  title: ReactNode;
  yLabel: string;
}

const electabilityChartData = [
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

/** Renders the candidate electability chart with MDX-owned labels. */
export function ElectabilityChart({
  title,
  description,
  yLabel,
  footnote,
  labels,
}: ElectabilityChartProps) {
  const chartConfig = {
    anies_muhaimin: {
      label: labels.aniesMuhaimin,
      colors: { light: ["var(--chart-1)"] },
    },
    prabowo_gibran: {
      label: labels.prabowoGibran,
      colors: { light: ["var(--chart-2)"] },
    },
    ganjar_mahfud: {
      label: labels.ganjarMahfud,
      colors: { light: ["var(--chart-3)"] },
    },
  } satisfies ChartConfig;

  return (
    <Frame>
      <FrameHeader>
        <FrameTitle>{title}</FrameTitle>
        <FrameDescription>{description}</FrameDescription>
      </FrameHeader>
      <FramePanel>
        <ChartContainer config={chartConfig}>
          <ChartLineChart accessibilityLayer data={electabilityChartData}>
            <ChartCartesianGrid vertical={false} />
            <ChartXAxis
              axisLine={false}
              dataKey="date"
              tickFormatter={(value) => {
                const date = new Date(value);
                return format(date, "MMM yyyy");
              }}
              tickLine={false}
              tickMargin={8}
            />
            <ChartYAxis
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
                    format(new Date(String(value)), "MMMM yyyy")
                  }
                />
              }
              cursor={false}
            />
            <ChartLine
              dataKey="anies_muhaimin"
              dot={false}
              stroke="var(--color-anies_muhaimin-0)"
              strokeWidth={2}
              type="natural"
            />
            <ChartLine
              dataKey="prabowo_gibran"
              dot={false}
              stroke="var(--color-prabowo_gibran-0)"
              strokeWidth={2}
              type="natural"
            />
            <ChartLine
              dataKey="ganjar_mahfud"
              dot={false}
              stroke="var(--color-ganjar_mahfud-0)"
              strokeWidth={2}
              type="natural"
            />
            <ChartLegend content={<ChartLegendContent />} />
          </ChartLineChart>
        </ChartContainer>
      </FramePanel>
      <FrameFooter>
        <p className="text-sm">{footnote}</p>
      </FrameFooter>
    </Frame>
  );
}
