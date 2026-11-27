import { Line } from "@repo/design-system/components/evilcharts/charts/line/series";
import type { CurveType } from "@repo/design-system/components/evilcharts/charts/line-chart";
import {
  EvilLineChart,
  Grid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from "@repo/design-system/components/evilcharts/charts/line-chart";
import type { ChartConfig } from "@repo/design-system/components/evilcharts/ui/chart-config";
import { Array as Arr, Predicate, Record as Rec, Result } from "effect";
import type { ReactNode } from "react";
import {
  ReferenceDot,
  ReferenceLine,
  useXAxisScale,
  useYAxisScale,
} from "recharts";

const MARGIN = { bottom: 12, left: 0, right: 12, top: 8 } as const;

type Row = Readonly<Record<string, number | null>>;

/**
 * The record a biology lab keeps under its scene: one or more curves against
 * one axis, with a cursor at the value the scene shows now. It stands in the
 * card's footer, so the scene above stays the one picture of the organism and
 * the chart stays the one picture of its numbers. Every row holds the axis
 * value under `x` and each curve's value under its own key; a band shades
 * between the values of its `low` and `high` keys, and skips a row where
 * either is missing. A curve without a label is drawn but kept out of the legend
 * and the tooltip.
 */
export function BiologyTrace({
  bands = [],
  curve = "monotone",
  cursor,
  floor = 0,
  rows,
  series,
  ticks,
  top,
  xLabel,
}: {
  readonly bands?: readonly {
    readonly color: string;
    readonly high: string;
    readonly low: string;
    readonly opacity: number;
  }[];
  readonly curve?: CurveType;
  readonly cursor?: { readonly x: number; readonly y?: number } | undefined;
  readonly floor?: number;
  readonly rows: readonly Row[];
  readonly series: readonly {
    readonly color: string;
    readonly dashed?: boolean;
    readonly key: string;
    readonly label?: ReactNode | undefined;
  }[];
  readonly ticks?: readonly number[];
  readonly top?: number;
  readonly xLabel?: string;
}) {
  const config: ChartConfig = Rec.fromEntries(
    Arr.map(series, (entry) => [
      entry.key,
      {
        colors: { dark: [entry.color], light: [entry.color] },
        label: entry.label,
      },
    ])
  );

  return (
    <EvilLineChart
      animationType="none"
      chartProps={{ margin: MARGIN }}
      className="aspect-[1.8] max-h-56 w-full"
      config={config}
      curveType={curve}
      data={[...rows]}
    >
      <Grid vertical={false} />
      <XAxis
        dataKey="x"
        domain={["dataMin", "dataMax"]}
        height={xLabel === undefined ? 28 : 44}
        type="number"
        {...(xLabel === undefined
          ? {}
          : { label: { offset: 0, position: "insideBottom", value: xLabel } })}
      />
      <YAxis
        domain={[floor, top ?? "auto"]}
        width={44}
        {...(ticks === undefined ? {} : { ticks: [...ticks] })}
      />
      <Tooltip />
      <Legend />
      {Arr.map(bands, (band) => (
        <Band
          color={band.color}
          high={band.high}
          key={band.high}
          low={band.low}
          opacity={band.opacity}
          rows={rows}
        />
      ))}
      {Arr.map(series, (entry) => (
        <Line
          dataKey={entry.key}
          key={entry.key}
          lineProps={{
            activeDot: false,
            dot: false,
            strokeWidth: 2,
            ...(entry.label === undefined
              ? { legendType: "none", tooltipType: "none" }
              : {}),
          }}
          strokeVariant={entry.dashed ? "dashed" : "solid"}
        />
      ))}
      {cursor === undefined ? null : (
        <ReferenceLine
          stroke="var(--foreground)"
          strokeDasharray="4 4"
          strokeOpacity={0.5}
          x={cursor.x}
        />
      )}
      {cursor?.y === undefined ? null : (
        <ReferenceDot
          fill="var(--foreground)"
          r={4}
          stroke="var(--background)"
          strokeWidth={2}
          x={cursor.x}
          y={cursor.y}
        />
      )}
    </EvilLineChart>
  );
}

/**
 * The shading between a band's low and high values on each row, drawn on the
 * chart's own scales: along the high values, then back along the low ones.
 */
function Band({
  color,
  high,
  low,
  opacity,
  rows,
}: {
  readonly color: string;
  readonly high: string;
  readonly low: string;
  readonly opacity: number;
  readonly rows: readonly Row[];
}) {
  const across = useXAxisScale();
  const up = useYAxisScale();
  if (across === undefined || up === undefined) {
    return null;
  }
  const edges = Arr.filterMap(rows, (row) => {
    const x = row.x;
    const bottom = row[low];
    const top = row[high];
    if (
      !(
        Predicate.isNumber(x) &&
        Predicate.isNumber(bottom) &&
        Predicate.isNumber(top)
      )
    ) {
      return Result.failVoid;
    }
    return Result.succeed({
      high: `${across(x)},${up(top)}`,
      low: `${across(x)},${up(bottom)}`,
    });
  });
  const outline = Arr.appendAll(
    Arr.map(edges, (edge) => edge.high),
    Arr.reverse(Arr.map(edges, (edge) => edge.low))
  );
  return (
    <polygon
      fill={color}
      fillOpacity={opacity}
      points={Arr.join(outline, " ")}
    />
  );
}
