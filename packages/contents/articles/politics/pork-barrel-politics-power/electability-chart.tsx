"use client";

import {
  ActiveDot,
  Dot,
  EvilLineChart,
  Grid,
  Legend,
  Line,
  XAxis,
  YAxis,
} from "@repo/design-system/components/evilcharts/charts/line-chart";
import type { ChartConfig } from "@repo/design-system/components/evilcharts/ui/chart-config";
import {
  ChartTooltip,
  ChartTooltipContent,
} from "@repo/design-system/components/evilcharts/ui/tooltip";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { getLineSeriesCue } from "@repo/design-system/lib/chart-series-cue";
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

const ELECTABILITY_CUES = {
  aniesMuhaimin: getLineSeriesCue(0),
  prabowoGibran: getLineSeriesCue(1),
  ganjarMahfud: getLineSeriesCue(2),
};

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
      cue: ELECTABILITY_CUES.aniesMuhaimin,
      label: labels.aniesMuhaimin,
      colors: { light: ["var(--chart-1)"], dark: ["var(--chart-1)"] },
    },
    prabowo_gibran: {
      cue: ELECTABILITY_CUES.prabowoGibran,
      label: labels.prabowoGibran,
      colors: { light: ["var(--chart-2)"], dark: ["var(--chart-2)"] },
    },
    ganjar_mahfud: {
      cue: ELECTABILITY_CUES.ganjarMahfud,
      label: labels.ganjarMahfud,
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
        <EvilLineChart
          config={chartConfig}
          curveType="natural"
          data={electabilityChartData}
        >
          <Grid vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(value) => {
              const date = new Date(value);
              return format(date, "MMM yyyy");
            }}
            tickMargin={8}
          />
          <YAxis
            label={{
              value: yLabel,
              angle: -90,
              position: "insideLeft",
              style: { textAnchor: "middle" },
            }}
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
          <Line
            dataKey="anies_muhaimin"
            lineProps={{
              strokeDasharray: ELECTABILITY_CUES.aniesMuhaimin.strokeDasharray,
              strokeWidth: 2,
            }}
          >
            <Dot variant={ELECTABILITY_CUES.aniesMuhaimin.dot} />
            <ActiveDot variant={ELECTABILITY_CUES.aniesMuhaimin.activeDot} />
          </Line>
          <Line
            dataKey="prabowo_gibran"
            lineProps={{
              strokeDasharray: ELECTABILITY_CUES.prabowoGibran.strokeDasharray,
              strokeWidth: 2,
            }}
          >
            <Dot variant={ELECTABILITY_CUES.prabowoGibran.dot} />
            <ActiveDot variant={ELECTABILITY_CUES.prabowoGibran.activeDot} />
          </Line>
          <Line
            dataKey="ganjar_mahfud"
            lineProps={{
              strokeDasharray: ELECTABILITY_CUES.ganjarMahfud.strokeDasharray,
              strokeWidth: 2,
            }}
          >
            <Dot variant={ELECTABILITY_CUES.ganjarMahfud.dot} />
            <ActiveDot variant={ELECTABILITY_CUES.ganjarMahfud.activeDot} />
          </Line>
          <Legend />
        </EvilLineChart>
      </CardContent>
      <CardFooter>
        <p className="text-sm">{footnote}</p>
      </CardFooter>
    </Card>
  );
}
