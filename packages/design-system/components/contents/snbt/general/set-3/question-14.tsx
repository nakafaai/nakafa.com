import { ChartDataProvider } from "@repo/design-system/components/contents/mathematics/chart/context";
import { ChartSeriesFacts } from "@repo/design-system/components/contents/mathematics/chart/facts";
import { Bar } from "@repo/design-system/components/evilcharts/charts/bar/series";
import {
  EvilBarChart,
  Grid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from "@repo/design-system/components/evilcharts/charts/bar-chart";
import type { ChartConfig } from "@repo/design-system/components/evilcharts/ui/chart-config";
import {
  VisualCard,
  VisualCardActions,
  VisualCardBody,
  VisualCardFooter,
  VisualCardFullscreen,
  VisualCardHeader,
} from "@repo/design-system/components/visual/card";
import { getBarSeriesCue } from "@repo/design-system/lib/charts/series-cue";
import { Array as Arr, Record as Rec } from "effect";
import { type ReactNode, useMemo } from "react";

const chartData = [
  { month: "august", garlic: 58, shallot: 48, chili: 54 },
  { month: "september", garlic: 61, shallot: 54, chili: 58 },
  { month: "october", garlic: 67, shallot: 60, chili: 62 },
  { month: "november", garlic: 76, shallot: 66, chili: 68 },
  { month: "december", garlic: 88, shallot: 72, chili: 72 },
] as const;

type ChartMonth = (typeof chartData)[number]["month"];

interface Props {
  description: ReactNode;
  monthLabels: Record<ChartMonth, string>;
  seriesLabels: {
    chili: string;
    garlic: string;
    shallot: string;
  };
  title: ReactNode;
  yAxisLabel: string;
}

/** Renders the spice sales chart with MDX-owned copy. */
export function SpiceSalesChart({
  description,
  monthLabels,
  seriesLabels,
  title,
  yAxisLabel,
}: Props) {
  const data = useMemo(
    () =>
      Arr.map(chartData, (item) => ({
        ...item,
        month: monthLabels[item.month],
      })),
    [monthLabels]
  );

  const chartConfig = useMemo(
    () =>
      ({
        garlic: {
          cue: getBarSeriesCue(0),
          label: seriesLabels.garlic,
          colors: { light: ["var(--chart-1)"], dark: ["var(--chart-1)"] },
        },
        shallot: {
          cue: getBarSeriesCue(1),
          label: seriesLabels.shallot,
          colors: { light: ["var(--chart-2)"], dark: ["var(--chart-2)"] },
        },
        chili: {
          cue: getBarSeriesCue(2),
          label: seriesLabels.chili,
          colors: { light: ["var(--chart-3)"], dark: ["var(--chart-3)"] },
        },
      }) satisfies ChartConfig,
    [seriesLabels.chili, seriesLabels.garlic, seriesLabels.shallot]
  );

  const chartSummary = useMemo(
    () => ({
      categories: Arr.map(data, (row) => row.month),
      series: [
        {
          key: "garlic",
          label: chartConfig.garlic.label,
          color: chartConfig.garlic.colors.light[0],
          values: Arr.map(data, (row) => row.garlic),
        },
        {
          key: "shallot",
          label: chartConfig.shallot.label,
          color: chartConfig.shallot.colors.light[0],
          values: Arr.map(data, (row) => row.shallot),
        },
        {
          key: "chili",
          label: chartConfig.chili.label,
          color: chartConfig.chili.colors.light[0],
          values: Arr.map(data, (row) => row.chili),
        },
      ],
    }),
    [chartConfig, data]
  );

  return (
    <ChartDataProvider data={chartSummary}>
      <VisualCard>
        <VisualCardHeader description={description} title={title} />
        <VisualCardBody className="p-(--card-spacing)">
          <EvilBarChart
            className="aspect-video"
            config={chartConfig}
            data={data}
          >
            <Grid vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="month"
              tickLine={false}
              tickMargin={10}
            />
            <YAxis
              axisLine={false}
              label={{
                value: yAxisLabel,
                angle: -90,
                position: "insideLeft",
              }}
              tickLine={false}
              tickMargin={10}
            />
            <Tooltip />
            <Legend />
            {Arr.map(Rec.keys(chartConfig), (key, index) => {
              const cue = getBarSeriesCue(index);

              return (
                <Bar
                  dataKey={key}
                  key={key}
                  radius={cue.radius}
                  variant={cue.variant}
                />
              );
            })}
          </EvilBarChart>
        </VisualCardBody>
        <VisualCardActions>
          <VisualCardFullscreen />
        </VisualCardActions>
        <VisualCardFooter>
          <ChartSeriesFacts />
        </VisualCardFooter>
      </VisualCard>
    </ChartDataProvider>
  );
}
