import { axisOf } from "@repo/design-system/components/contents/mathematics/journey/axis";
import { lastMinute } from "@repo/design-system/components/contents/mathematics/journey/clock";
import type { Mark } from "@repo/design-system/components/contents/mathematics/journey/plot";
import {
  letterSide,
  routeOf,
  travelledOf,
} from "@repo/design-system/components/contents/mathematics/journey/plot";
import type { Units } from "@repo/design-system/components/contents/mathematics/journey/readout";
import type {
  Stage,
  Traveller,
} from "@repo/design-system/components/contents/mathematics/journey/trip";
import {
  cornerName,
  farthestOf,
  lengthOf,
  motionOf,
} from "@repo/design-system/components/contents/mathematics/journey/trip";
import { Line } from "@repo/design-system/components/evilcharts/charts/line/series";
import {
  EvilLineChart,
  Grid,
  XAxis,
  YAxis,
} from "@repo/design-system/components/evilcharts/charts/line-chart";
import type { ChartConfig } from "@repo/design-system/components/evilcharts/ui/chart-config";
import { JOURNEY_COLORS } from "@repo/design-system/lib/material/journey";
import { Array as Arr, Option } from "effect";
import { ReferenceDot, ReferenceLine } from "recharts";
import { useFormatter } from "use-intl";

/** About how many times as wide as tall the graph is drawn, which decides where a corner's letter clears its lines. */
const SHAPE = 1.7;

/** The room round the plot, in pixels. */
const MARGIN = { bottom: 8, left: 8, right: 24, top: 30 } as const;

/** One row of a traveller's line: a minute of the clock and its distance under the traveller's key. */
function rowsOf(marks: readonly Mark[], key: "bus" | "second") {
  return Arr.map(marks, (mark) => ({
    bus: key === "bus" ? mark.km : null,
    minute: mark.minute,
    second: key === "second" ? mark.km : null,
  }));
}

/**
 * The distance-time graph the journey draws, under the scene: time across
 * and distance from the start up. Each traveller's whole route is drawn
 * faint, and the part already travelled by `minute` bold over it, ending in
 * a dot where the traveller is now, level with its vehicle on the road. The
 * bus's corners carry their letters. The leg in `focus` is drawn bolder with
 * its run and its rise dashed, each marked with its size, and `meeting`
 * rings the crossing of two travellers' lines, with dashed guides to both
 * axes.
 */
export function JourneyGraph({
  bus,
  focus,
  meeting,
  minute,
  second,
  titles,
  units,
}: {
  readonly bus: Traveller;
  readonly focus: Option.Option<number>;
  readonly meeting: Option.Option<{
    readonly distance: number;
    readonly minute: number;
  }>;
  readonly minute: number;
  readonly second: Option.Option<Traveller>;
  readonly titles: { readonly distance: string; readonly time: string };
  readonly units: Units;
}) {
  const format = useFormatter();
  const size = (value: number, unit: string) =>
    `${format.number(value, "math", { maximumFractionDigits: 1 })} ${unit}`;
  const trips = Option.match(second, {
    onNone: () => Arr.of(bus.stages),
    onSome: (other) => Arr.make(bus.stages, other.stages),
  });
  const axes = {
    km: axisOf(Math.max(...Arr.map(trips, farthestOf)), 5),
    minute: axisOf(lastMinute(trips), 7),
  };
  const tops = { km: axes.km.top, minute: axes.minute.top };
  const route = routeOf(bus.stages);
  const config = {
    bus: {
      colors: { dark: [JOURNEY_COLORS.bus], light: [JOURNEY_COLORS.bus] },
      label: bus.name,
    },
    second: {
      colors: { dark: [JOURNEY_COLORS.bike], light: [JOURNEY_COLORS.bike] },
      label: Option.match(second, {
        onNone: () => bus.name,
        onSome: (other) => other.name,
      }),
    },
  } satisfies ChartConfig;
  const lines = [
    { key: "bus", stages: bus.stages } as const,
    ...Option.match(second, {
      onNone: () => [],
      onSome: (other) => [{ key: "second", stages: other.stages } as const],
    }),
  ];

  return (
    <EvilLineChart
      animationType="none"
      chartProps={{ margin: MARGIN }}
      className="aspect-[1.45] sm:aspect-video"
      config={config}
      data={rowsOf(route, "bus")}
    >
      <Grid />
      <XAxis
        dataKey="minute"
        domain={[0, tops.minute]}
        height={48}
        label={{ offset: 2, position: "insideBottom", value: titles.time }}
        ticks={[...axes.minute.ticks]}
        type="number"
      />
      <YAxis
        domain={[0, tops.km]}
        label={{
          angle: -90,
          position: "insideLeft",
          style: { textAnchor: "middle" },
          value: titles.distance,
        }}
        ticks={[...axes.km.ticks]}
        type="number"
      />
      <ReferenceLine
        stroke="var(--muted-foreground)"
        strokeDasharray="4 4"
        strokeOpacity={0.6}
        x={Math.min(minute, tops.minute)}
      />
      {Option.match(meeting, {
        onNone: () => null,
        onSome: (met) => (
          <>
            <ReferenceLine
              segment={[
                { x: met.minute, y: 0 },
                { x: met.minute, y: met.distance },
              ]}
              stroke={JOURNEY_COLORS.meeting}
              strokeDasharray="5 4"
              strokeWidth={1.5}
            />
            <ReferenceLine
              segment={[
                { x: 0, y: met.distance },
                { x: met.minute, y: met.distance },
              ]}
              stroke={JOURNEY_COLORS.meeting}
              strokeDasharray="5 4"
              strokeWidth={1.5}
            />
          </>
        ),
      })}
      {Arr.map(lines, (line) => (
        <Line
          dataKey={line.key}
          key={`${line.key}-route`}
          lineProps={{
            activeDot: false,
            data: rowsOf(routeOf(line.stages), line.key),
            dot: false,
            strokeLinecap: "round",
            strokeLinejoin: "round",
            strokeOpacity: 0.3,
            strokeWidth: 2,
          }}
        />
      ))}
      {Arr.map(lines, (line) => (
        <Line
          dataKey={line.key}
          key={`${line.key}-travelled`}
          lineProps={{
            activeDot: false,
            data: rowsOf(travelledOf(line.stages, minute), line.key),
            dot: false,
            strokeLinecap: "round",
            strokeLinejoin: "round",
            strokeWidth: 3.25,
          }}
        />
      ))}
      {Option.match(
        Option.flatMap(focus, (part) => Arr.get(bus.stages, part)),
        {
          onNone: () => null,
          onSome: (stage) => (
            <SlopeGuides
              rise={size(lengthOf(stage), units.distance)}
              run={size(stage.end - stage.start, units.time)}
              stage={stage}
            />
          ),
        }
      )}
      {Arr.map(route, (mark, index) => (
        <ReferenceDot
          fill={JOURNEY_COLORS.bus}
          key={mark.minute}
          label={{
            fill: "var(--foreground)",
            fontSize: 13,
            fontWeight: 600,
            offset: 9,
            position: letterSide(
              mark,
              Arr.getSomes([
                Arr.get(route, index - 1),
                Arr.get(route, index + 1),
              ]),
              tops,
              SHAPE
            ),
            value: cornerName(index),
          }}
          r={3.5}
          stroke="var(--background)"
          strokeWidth={1.5}
          x={mark.minute}
          y={mark.km}
        />
      ))}
      {Arr.map(lines, (line) =>
        Option.match(Arr.last(travelledOf(line.stages, minute)), {
          onNone: () => null,
          onSome: (here) => (
            <ReferenceDot
              fill={
                line.key === "bus" ? JOURNEY_COLORS.bus : JOURNEY_COLORS.bike
              }
              key={`${line.key}-now`}
              r={6}
              stroke="var(--background)"
              strokeWidth={2.5}
              x={here.minute}
              y={here.km}
            />
          ),
        })
      )}
      {Option.match(meeting, {
        onNone: () => null,
        onSome: (met) => (
          <ReferenceDot
            fill="none"
            r={10}
            stroke={JOURNEY_COLORS.meeting}
            strokeWidth={2.5}
            x={met.minute}
            y={met.distance}
          />
        ),
      })}
    </EvilLineChart>
  );
}

/**
 * The run and the rise of the leg in focus, dashed: the run across from the
 * leg's start, marked with the time it takes, and the rise up or down to the
 * leg's end, marked with the distance it covers. A stop has no rise, as it
 * covers none. The leg itself is drawn bolder over them.
 */
function SlopeGuides({
  rise,
  run,
  stage,
}: {
  readonly rise: string;
  readonly run: string;
  readonly stage: Stage;
}) {
  const label = { fill: JOURNEY_COLORS.slope, fontSize: 12, offset: 6 };
  return (
    <>
      <ReferenceLine
        label={{
          ...label,
          position: motionOf(stage) === "away" ? "bottom" : "top",
          value: run,
        }}
        segment={[
          { x: stage.start, y: stage.from },
          { x: stage.end, y: stage.from },
        ]}
        stroke={JOURNEY_COLORS.slope}
        strokeDasharray="5 4"
        strokeWidth={1.5}
      />
      {motionOf(stage) === "still" ? null : (
        <ReferenceLine
          label={{
            ...label,
            position: "right",
            value: rise,
          }}
          segment={[
            { x: stage.end, y: stage.from },
            { x: stage.end, y: stage.to },
          ]}
          stroke={JOURNEY_COLORS.slope}
          strokeDasharray="5 4"
          strokeWidth={1.5}
        />
      )}
      <ReferenceLine
        segment={[
          { x: stage.start, y: stage.from },
          { x: stage.end, y: stage.to },
        ]}
        stroke={JOURNEY_COLORS.bus}
        strokeLinecap="round"
        strokeWidth={5.5}
      />
    </>
  );
}
