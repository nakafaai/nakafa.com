import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { Line } from "@repo/design-system/components/evilcharts/charts/composed/line";
import type { CurveType } from "@repo/design-system/components/evilcharts/charts/composed-chart";
import {
  EvilComposedChart,
  Grid,
  ReferenceLine,
  XAxis,
  YAxis,
} from "@repo/design-system/components/evilcharts/charts/composed-chart";
import type { ChartConfig } from "@repo/design-system/components/evilcharts/ui/chart-config";
import {
  ChartTooltip,
  ChartTooltipContent,
} from "@repo/design-system/components/evilcharts/ui/tooltip";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { cn } from "cn";
import { Array as Arr, Record as Rec } from "effect";
import type { PointerEvent, ReactNode } from "react";
import {
  Area,
  ReferenceArea,
  ReferenceDot,
  usePlotArea,
  ZIndexLayer,
} from "recharts";
import { useFormatter } from "use-intl";

/** One row of a footer chart: the reading of the horizontal axis and of each curve and band at it. */
type TraceRow = Record<string, number | readonly [number, number] | null>;

/** How one entry of the key is drawn: as its curve, a dashed line, a shaded band, or a point. */
type TraceKind = "band" | "dashed" | "line" | "point";

/** One axis of a footer chart: its range, the values it marks, and what it measures. */
interface TraceAxis {
  readonly domain: readonly [number, number];
  readonly label?: ReactNode;
  readonly scale?: "linear" | "log";
  readonly ticks?: readonly number[];
}

/** One curve of a footer chart. A curve with a label appears in the key and in the tooltip. */
interface TraceSeries {
  readonly color: string;
  readonly curve?: CurveType;
  readonly dashed?: boolean;
  /** Rows of this curve's own, for a curve that is not sampled where the chart's rows are. */
  readonly data?: TraceRow[];
  readonly key: string;
  readonly label?: ReactNode;
  readonly width?: number;
}

/** An entry of the key for something that is not a curve, such as a shaded band or a marked point. */
interface TraceMark {
  readonly color: string;
  readonly kind: TraceKind;
  readonly label: ReactNode;
}

/** The layer the probe takes pointers on, above the marks and the curves of the chart. */
const PROBE_LAYER = 3000;

const MARGIN = { bottom: 0, left: 0, right: 16, top: 12 };

/** The swatch that stands for one entry of the key, drawn the way the chart draws the entry itself. */
function TraceSwatch({ color, kind }: Pick<TraceMark, "color" | "kind">) {
  if (kind === "dashed") {
    return (
      <span
        aria-hidden="true"
        className="w-4 shrink-0 border-t-2 border-dashed"
        style={{ borderColor: color }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn("shrink-0", {
        "h-0.5 w-4 rounded-full": kind === "line",
        "size-2.5 rounded-full": kind === "point",
        "size-3 rounded-xs opacity-40": kind === "band",
      })}
      style={{ backgroundColor: color }}
    />
  );
}

/**
 * The chart a lab keeps under its scene, in the footer of its card: curves
 * against one numeric axis, drawn by EvilCharts with a grid, numbered axes,
 * a tooltip that reads every labelled curve, and a key above the plot. The
 * scene itself stays a single visual, so whatever a lab plots beside it goes
 * through this chart. Marks such as {@link TraceCursor}, {@link TraceBand},
 * {@link TraceFill} and {@link TracePoint} are passed as children.
 */
export function TraceChart({
  children,
  data,
  marks = [],
  series,
  tooltip = true,
  x,
  y,
}: {
  readonly children?: ReactNode;
  readonly data: TraceRow[];
  readonly marks?: readonly TraceMark[];
  readonly series: readonly TraceSeries[];
  /** Whether hovering reads the labelled curves. A chart whose curves keep rows of their own has no shared row to read. */
  readonly tooltip?: boolean;
  readonly x: TraceAxis & { readonly key: string };
  readonly y: TraceAxis;
}) {
  const format = useFormatter();
  const quantity = useQuantity();
  const config = Rec.fromEntries(
    Arr.map(series, (one) => [
      one.key,
      {
        colors: { dark: [one.color], light: [one.color] },
        label: one.label,
      },
    ])
  ) satisfies ChartConfig;
  const key = [
    ...Arr.flatMap(series, (one) =>
      one.label === undefined
        ? []
        : [
            {
              color: one.color,
              id: one.key,
              kind: one.dashed ? ("dashed" as const) : ("line" as const),
              label: one.label,
            },
          ]
    ),
    ...Arr.map(marks, (mark, index) => ({ ...mark, id: `mark-${index}` })),
  ];
  const tick = (value: number) => format.number(value, "math");

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {y.label === undefined ? null : (
          <span className="text-foreground me-auto font-medium">{y.label}</span>
        )}
        {Arr.map(key, (entry) => (
          <span className="flex items-center gap-1.5" key={entry.id}>
            <TraceSwatch color={entry.color} kind={entry.kind} />
            {entry.label}
          </span>
        ))}
      </figcaption>
      <EvilComposedChart
        chartProps={{ margin: MARGIN }}
        className="aspect-[1.9] max-h-64 sm:aspect-[3.2]"
        config={config}
        data={data}
      >
        <Grid />
        <XAxis
          allowDataOverflow
          dataKey={x.key}
          domain={[...x.domain]}
          scale={x.scale ?? "linear"}
          tickFormatter={tick}
          {...(x.ticks === undefined ? {} : { ticks: [...x.ticks] })}
          type="number"
        />
        <YAxis
          allowDataOverflow
          domain={[...y.domain]}
          tickFormatter={tick}
          {...(y.ticks === undefined ? {} : { ticks: [...y.ticks] })}
          type="number"
        />
        {tooltip ? (
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(value: unknown) =>
                  typeof value === "number" ? (
                    <span className="flex items-baseline gap-1.5">
                      {x.label}
                      <InlineMath math={quantity(value, "", 2)} />
                    </span>
                  ) : null
                }
              />
            }
          />
        ) : null}
        {children}
        {Arr.map(series, (one) => (
          <Line
            curveType={one.curve ?? "monotone"}
            dataKey={one.key}
            key={one.key}
            lineProps={{
              strokeLinecap: "round",
              strokeLinejoin: "round",
              strokeWidth: one.width ?? 2.5,
              ...(one.data === undefined ? {} : { data: one.data }),
              ...(one.label === undefined ? { tooltipType: "none" } : {}),
            }}
            strokeVariant={one.dashed ? "dashed" : "solid"}
          />
        ))}
      </EvilComposedChart>
      {x.label === undefined ? null : (
        <div className="text-muted-foreground text-center text-sm">
          {x.label}
        </div>
      )}
    </figure>
  );
}

/** The reading the scene shows now, as a thin vertical line across the plot. */
export function TraceCursor({ x }: { readonly x: number }) {
  return (
    <ReferenceLine stroke="var(--foreground)" strokeOpacity={0.45} x={x} />
  );
}

/** A threshold on the horizontal axis, as a dashed vertical line in its own color. */
export function TraceGuide({
  color,
  x,
}: {
  readonly color: string;
  readonly x: number;
}) {
  return (
    <ReferenceLine
      stroke={color}
      strokeDasharray="5 4"
      strokeWidth={1.75}
      x={x}
    />
  );
}

/** A range of the horizontal axis, shaded over the whole height of the plot. */
export function TraceBand({
  color,
  from,
  to,
}: {
  readonly color: string;
  readonly from: number;
  readonly to: number;
}) {
  return (
    <ReferenceArea
      fill={color}
      fillOpacity={0.14}
      stroke="none"
      x1={from}
      x2={to}
    />
  );
}

/**
 * A shaded region the rows describe themselves: under a curve when the row
 * holds one number, between two curves when it holds a pair, and absent where
 * it holds `null`.
 */
export function TraceFill({
  color,
  data,
  dataKey,
  opacity = 0.3,
}: {
  readonly color: string;
  /** Rows of this region's own, for a region that is not sampled where the chart's rows are. */
  readonly data?: TraceRow[];
  readonly dataKey: string;
  readonly opacity?: number;
}) {
  return (
    <Area
      activeDot={false}
      {...(data === undefined ? {} : { data })}
      dataKey={dataKey}
      fill={color}
      fillOpacity={opacity}
      isAnimationActive={false}
      legendType="none"
      stroke="none"
      tooltipType="none"
      type="linear"
    />
  );
}

/** The point the scene shows now, ringed in the color of the card so it stays clear of the curve under it. */
export function TracePoint({
  color,
  name,
  x,
  y,
}: {
  readonly color: string;
  /** A short name written above the point, such as the number of a state. */
  readonly name?: string;
  readonly x: number;
  readonly y: number;
}) {
  return (
    <ReferenceDot
      fill={color}
      {...(name === undefined
        ? {}
        : {
            label: {
              fill: "var(--foreground)",
              fontSize: 13,
              fontWeight: 600,
              offset: 10,
              position: "top" as const,
              value: name,
            },
          })}
      r={5.5}
      stroke="var(--card)"
      strokeWidth={2}
      x={x}
      y={y}
    />
  );
}

/**
 * Lets the reader press or drag on the plot to set a value: it covers the
 * plot and reports where the pointer stands as shares of its width and
 * height, from the origin. A finger still scrolls the page up and down over
 * it, so a press sets the value on a phone and a drag does with a mouse.
 */
export function TraceProbe({
  onSpot,
}: {
  readonly onSpot: (spot: { readonly x: number; readonly y: number }) => void;
}) {
  const plot = usePlotArea();
  if (plot === undefined) {
    return null;
  }
  const report = (event: PointerEvent<SVGRectElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    onSpot({
      x: Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)),
      y: Math.min(1, Math.max(0, 1 - (event.clientY - box.top) / box.height)),
    });
  };

  // Above every mark of the chart, so a press on a point or a curve still reaches it.
  return (
    <ZIndexLayer zIndex={PROBE_LAYER}>
      <rect
        className="cursor-crosshair touch-pan-y"
        fill="transparent"
        height={plot.height}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          report(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            report(event);
          }
        }}
        width={plot.width}
        x={plot.x}
        y={plot.y}
      />
    </ZIndexLayer>
  );
}
