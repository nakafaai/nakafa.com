import { Bar } from "@repo/design-system/components/evilcharts/charts/bar/series";
import {
  EvilBarChart,
  Grid,
  Tooltip,
  XAxis,
  YAxis,
} from "@repo/design-system/components/evilcharts/charts/bar-chart";
import type { ChartConfig } from "@repo/design-system/components/evilcharts/ui/chart-config";

const data = [
  { month: "Jan", read: 42, done: 18 },
  { month: "Feb", read: 56, done: 27 },
  { month: "Mar", read: 61, done: 35 },
  { month: "Apr", read: 74, done: 41 },
  { month: "May", read: 88, done: 52 },
];

const config = {
  read: {
    label: "Lessons read",
    colors: { light: ["var(--chart-1)"], dark: ["var(--chart-1)"] },
  },
  done: {
    label: "Exercises done",
    colors: { light: ["var(--chart-2)"], dark: ["var(--chart-2)"] },
  },
} satisfies ChartConfig;

export const card = {
  name: "BarChart",
  group: "Content",
  height: 340,
  source: "components/evilcharts/charts/bar-chart",
  declaration: "EvilBarChart",
};

/** Two series of bars over five months, in the first two chart colors. */
export function Preview() {
  return (
    <div className="max-w-xl p-6">
      <EvilBarChart className="aspect-video" config={config} data={data}>
        <Grid vertical={false} />
        <XAxis dataKey="month" tickMargin={10} />
        <YAxis />
        <Tooltip />
        <Bar dataKey="read" />
        <Bar dataKey="done" />
      </EvilBarChart>
    </div>
  );
}
