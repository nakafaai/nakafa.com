import { axisTicks } from "@repo/design-system/components/contents/physics/kinematics/ticks";
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

/** One row of the graph: a moment, and the value of whichever marker stands there. */
const RowSchema = Schema.Struct({
  end: Schema.optional(Schema.Finite),
  start: Schema.optional(Schema.Finite),
  x: Schema.Finite,
});

/** A point of the graph: a moment and the plotted quantity then. */
const PointSchema = Schema.Struct({ x: Schema.Finite, y: Schema.Finite });

const MARGIN = { bottom: 4, left: 0, right: 16, top: 12 };

/**
 * The motion graph under a kinematics scene, in the card's footer: the curve
 * the moving thing traces, the secant between the two moments a learner
 * picked, whose slope is the average rate, and optionally the tangent whose
 * slope is the instantaneous rate. The two moments are marked in the colours
 * their markers carry in the scene, so the graph and the place read as one.
 * Each axis names its quantity in KaTeX, and so does every legend entry.
 */
export function MotionPlot({
  curve,
  end,
  secant,
  start,
  tangent,
  x,
  y,
}: {
  readonly curve: {
    readonly color: string;
    readonly label: ReactNode;
    readonly points: readonly (typeof PointSchema.Type)[];
  };
  /** The later of the two moments, in its marker's colour. */
  readonly end: {
    readonly color: string;
    readonly label: ReactNode;
    readonly point: typeof PointSchema.Type;
  };
  /** The name of the secant's slope. */
  readonly secant: ReactNode;
  /** The earlier of the two moments, in its marker's colour. */
  readonly start: {
    readonly color: string;
    readonly label: ReactNode;
    readonly point: typeof PointSchema.Type;
  };
  /** The tangent, as the two points its line is drawn between, and the name of its slope. */
  readonly tangent?: {
    readonly label: ReactNode;
    readonly points: readonly (typeof PointSchema.Type)[];
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
    curve: {
      colors: { dark: [curve.color], light: [curve.color] },
      label: curve.label,
    },
    end: {
      colors: { dark: [end.color], light: [end.color] },
      label: end.label,
    },
    secant: {
      colors: { dark: [PLOT_COLORS.amber], light: [PLOT_COLORS.amber] },
      label: secant,
    },
    start: {
      colors: { dark: [start.color], light: [start.color] },
      label: start.label,
    },
    tangent: {
      colors: { dark: [PLOT_COLORS.slate], light: [PLOT_COLORS.slate] },
      label: tangent?.label,
    },
  };
  const across = axisTicks(x.domain[0], x.domain[1]);
  const up = axisTicks(y.domain[0], y.domain[1]);
  const starts: (typeof RowSchema.Type)[] = [
    { start: start.point.y, x: start.point.x },
  ];
  const ends: (typeof RowSchema.Type)[] = [
    { end: end.point.y, x: end.point.x },
  ];

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
        data={starts}
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
          dataKey="start"
          domain={[
            Option.getOrElse(Arr.head(up), () => y.domain[0]),
            Option.getOrElse(Arr.last(up), () => y.domain[1]),
          ]}
          tickFormatter={tick}
          tickMargin={6}
          ticks={up}
          type="number"
          width={44}
        />
        {tangent === undefined ? null : (
          <Line
            dataKey="tangent"
            lineProps={{
              activeDot: false,
              data: Arr.map(tangent.points, (point) => ({
                tangent: point.y,
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
        <Line
          dataKey="secant"
          lineProps={{
            activeDot: false,
            data: [
              { secant: start.point.y, x: start.point.x },
              { secant: end.point.y, x: end.point.x },
            ],
            dot: false,
            strokeWidth: 3,
            tooltipType: "none",
          }}
        />
        <Scatter data={starts} dataKey="start" />
        <Scatter data={ends} dataKey="end" />
        <Legend verticalAlign="bottom" />
      </EvilComposedChart>
      <span className="text-muted-foreground self-end text-xs">
        <InlineMath math={x.caption} />
      </span>
    </div>
  );
}
