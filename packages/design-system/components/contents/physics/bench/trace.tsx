import { Line } from "@repo/design-system/components/evilcharts/charts/composed/line";
import { Scatter } from "@repo/design-system/components/evilcharts/charts/composed/scatter";
import {
  EvilComposedChart,
  Grid,
  Legend,
  XAxis,
  YAxis,
} from "@repo/design-system/components/evilcharts/charts/composed-chart";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Option, Schema } from "effect";
import type { ReactNode } from "react";
import { useFormatter } from "use-intl";

/** One row of the chart: a place along it, and the height of whichever curve or marker stands there. */
const RowSchema = Schema.Struct({
  compare: Schema.optional(Schema.Finite),
  curve: Schema.optional(Schema.Finite),
  mark: Schema.optional(Schema.Finite),
  x: Schema.Finite,
});

const MARGIN = { bottom: 4, left: 0, right: 16, top: 12 };
const STEPS = [1, 2, 2.5, 5, 10] as const;

/**
 * The ticks of an axis that covers `domain`: about five of them, a round
 * step apart, from the start of the domain to the first tick at or beyond
 * its end, so every gridline is a number a reader can name.
 */
function axisTicks(domain: readonly [number, number]) {
  const [low, high] = domain;
  const rough = Math.max(high - low, Number.EPSILON) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step =
    Option.getOrElse(
      Arr.findFirst(STEPS, (candidate) => candidate * magnitude >= rough),
      () => 10
    ) * magnitude;
  const count = Math.ceil((high - low) / step - 1e-9);
  return Arr.makeBy(count + 1, (index) => low + index * step);
}

/**
 * The chart under a benchtop rig, in the card's footer: the main curve the
 * rig follows, an optional second curve to compare it with, and a marker at
 * the state the rig shows now, so the chart and the apparatus move together.
 * Each axis names its quantity in KaTeX beside it, and the legend names each
 * curve in KaTeX, so no symbol or unit is drawn as plain text.
 */
export function Trace({
  compare,
  curve,
  mark,
  x,
  y,
}: {
  readonly compare?: {
    readonly label: ReactNode;
    readonly points: readonly { readonly x: number; readonly y: number }[];
  };
  readonly curve: {
    readonly label: ReactNode;
    readonly points: readonly { readonly x: number; readonly y: number }[];
  };
  /** The state the rig shows now: where it stands along the chart and how high. */
  readonly mark: {
    readonly label: ReactNode;
    readonly point: { readonly x: number; readonly y: number };
  };
  /** The quantity and unit the horizontal axis measures, as KaTeX, and the range it covers. */
  readonly x: {
    readonly caption: string;
    readonly domain: readonly [number, number];
  };
  /** The quantity and unit the vertical axis measures, as KaTeX, and the range it covers. */
  readonly y: {
    readonly caption: string;
    readonly domain: readonly [number, number];
  };
}) {
  const formatter = useFormatter();
  const tick = (value: number) =>
    formatter.number(value, "math", { maximumFractionDigits: 2 });
  const config = {
    compare: {
      colors: { dark: [PLOT_COLORS.slate], light: [PLOT_COLORS.slate] },
      label: compare?.label,
    },
    curve: {
      colors: { dark: [PLOT_COLORS.teal], light: [PLOT_COLORS.teal] },
      label: curve.label,
    },
    mark: {
      colors: { dark: [PLOT_COLORS.pink], light: [PLOT_COLORS.pink] },
      label: mark.label,
    },
  };
  const across = axisTicks(x.domain);
  const up = axisTicks(y.domain);
  const marks = [{ mark: mark.point.y, x: mark.point.x }];
  const rows: (typeof RowSchema.Type)[] = marks;

  return (
    <div className="flex flex-col gap-1 p-(--card-spacing) pb-0">
      <span className="text-muted-foreground text-xs">
        <InlineMath math={y.caption} />
      </span>
      <EvilComposedChart
        animationType="none"
        chartProps={{ margin: MARGIN }}
        className="aspect-[1.5] max-h-60 sm:aspect-[2.4]"
        config={config}
        curveType="linear"
        data={rows}
      >
        <Grid />
        <XAxis
          dataKey="x"
          domain={[
            x.domain[0],
            Option.getOrElse(Arr.last(across), () => x.domain[1]),
          ]}
          tickFormatter={tick}
          tickMargin={6}
          ticks={across}
          type="number"
        />
        <YAxis
          dataKey="mark"
          domain={[
            y.domain[0],
            Option.getOrElse(Arr.last(up), () => y.domain[1]),
          ]}
          tickFormatter={tick}
          tickMargin={6}
          ticks={up}
          type="number"
          width={44}
        />
        {compare === undefined ? null : (
          <Line
            dataKey="compare"
            lineProps={{
              activeDot: false,
              data: Arr.map(compare.points, (point) => ({
                compare: point.y,
                x: point.x,
              })),
              dot: false,
              strokeDasharray: "6 5",
              tooltipType: "none",
            }}
          />
        )}
        <Line
          dataKey="curve"
          lineProps={{
            activeDot: false,
            data: Arr.map(curve.points, (point) => ({
              curve: point.y,
              x: point.x,
            })),
            dot: false,
            strokeWidth: 2.6,
            tooltipType: "none",
          }}
        />
        <Scatter data={rows} dataKey="mark" />
        <Legend verticalAlign="bottom" />
      </EvilComposedChart>
      <span className="text-muted-foreground self-end text-xs">
        <InlineMath math={x.caption} />
      </span>
    </div>
  );
}
