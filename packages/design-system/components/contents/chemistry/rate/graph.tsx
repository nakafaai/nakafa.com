import {
  amountAt,
  TIME_SPAN,
} from "@repo/design-system/components/contents/chemistry/rate/curve";
import type { RateRun } from "@repo/design-system/components/contents/chemistry/rate/scene";
import {
  largestAmount,
  RUN_COLORS,
} from "@repo/design-system/components/contents/chemistry/rate/scene";
import { Line } from "@repo/design-system/components/evilcharts/charts/line/series";
import {
  EvilLineChart,
  Grid,
  XAxis,
  YAxis,
} from "@repo/design-system/components/evilcharts/charts/line-chart";
import type { ChartConfig } from "@repo/design-system/components/evilcharts/ui/chart-config";
import { Array as Arr, Option } from "effect";
import { ReferenceDot, ReferenceLine } from "recharts";
import { useFormatter } from "use-intl";

/** How many samples each curve takes along the time axis. */
const SAMPLES = 80;

/** The room round the plot, in pixels. */
const MARGIN = { bottom: 8, left: 8, right: 24, top: 20 } as const;

/** Numbers on the amount axis keep three significant figures, as SPM working does. */
const READING = { maximumSignificantDigits: 3, useGrouping: false } as const;

/**
 * The amount of gas each run has collected against time, under the scene:
 * one curve per run from the formula that moves its plunger, steeper at the
 * start for a finer solid and levelling off at its final amount, with a dot
 * on each curve at the `time` chosen. The amount axis numbers only the final
 * amounts, which are data; the time axis carries no numbers, because the
 * steepness is a model.
 */
export function RateGraph({
  amountLabel,
  runs,
  time,
  timeLabel,
}: {
  readonly amountLabel: string;
  readonly runs: Arr.NonEmptyReadonlyArray<RateRun>;
  readonly time: number;
  readonly timeLabel: string;
}) {
  const format = useFormatter();
  const most = largestAmount(runs);
  const first = Arr.headNonEmpty(runs);
  const second = Option.getOrElse(Arr.get(runs, 1), () => first);
  const config = {
    first: { colors: { dark: [RUN_COLORS[0]], light: [RUN_COLORS[0]] } },
    second: { colors: { dark: [RUN_COLORS[1]], light: [RUN_COLORS[1]] } },
  } satisfies ChartConfig;
  const data = Arr.makeBy(SAMPLES + 1, (step) => {
    const t = (step / SAMPLES) * TIME_SPAN;
    return {
      first: amountAt(first.amount, first.solid, t),
      second: amountAt(second.amount, second.solid, t),
      time: t,
    };
  });
  const keys =
    runs.length > 1 ? (["first", "second"] as const) : (["first"] as const);

  return (
    <EvilLineChart
      animationType="none"
      chartProps={{ margin: MARGIN }}
      className="aspect-[1.45] sm:aspect-[2.4]"
      config={config}
      curveType="monotone"
      data={data}
    >
      <Grid />
      <XAxis
        dataKey="time"
        domain={[0, TIME_SPAN]}
        height={36}
        label={{ offset: 4, position: "insideBottom", value: timeLabel }}
        tick={false}
        type="number"
      />
      <YAxis
        domain={[0, most * 1.1]}
        label={{
          angle: -90,
          position: "insideLeft",
          style: { textAnchor: "middle" },
          value: amountLabel,
        }}
        tickFormatter={(value: number) => format.number(value, READING)}
        ticks={[0, ...Arr.dedupe(Arr.map(runs, (run) => run.amount))]}
        type="number"
      />
      <ReferenceLine
        stroke="var(--muted-foreground)"
        strokeDasharray="4 4"
        strokeOpacity={0.6}
        x={time}
      />
      {Arr.map(keys, (key) => (
        <Line
          dataKey={key}
          key={key}
          lineProps={{ activeDot: false, dot: false, strokeWidth: 3 }}
        />
      ))}
      {Arr.map(runs, (run, index) => (
        <ReferenceDot
          fill={RUN_COLORS[index === 0 ? 0 : 1]}
          key={String(index)}
          r={6}
          stroke="var(--background)"
          strokeWidth={2.5}
          x={time}
          y={amountAt(run.amount, run.solid, time)}
        />
      ))}
    </EvilLineChart>
  );
}
