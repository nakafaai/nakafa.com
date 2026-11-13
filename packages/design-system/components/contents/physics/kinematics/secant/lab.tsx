import {
  advanceRun,
  shownTime,
} from "@repo/design-system/components/contents/physics/canvas/clock";
import {
  dashed,
  fade,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import {
  type Graph,
  graphX,
  graphY,
  paintCurve,
  paintGraph,
  paintGraphDot,
  paintSlopeLine,
} from "@repo/design-system/components/contents/physics/canvas/plot";
import {
  paintCar,
  paintLandscape,
  paintRoad,
  type Road,
  roadX,
} from "@repo/design-system/components/contents/physics/canvas/scene";
import {
  changeOver,
  type Trip,
  type TripGraph,
  tripDuration,
  tripIntervals,
  tripReach,
  tripState,
  tripValue,
} from "@repo/design-system/components/contents/physics/kinematics/secant/trip";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { P5Sketch } from "@repo/design-system/components/visual/sketch";
import { getColor } from "@repo/design-system/lib/color";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** Simulated seconds per wall second: a 20 s commute plays in 10 s. */
const PLAY_RATE = 2;

/** How long the finished trip rests before it starts again, in wall seconds. */
const HOLD_SECONDS = 1.5;

/** What the sketch reads on every frame: the trip and the chosen interval. */
interface SecantFrame {
  readonly graph: TripGraph;
  readonly interval: readonly [number, number];
  readonly trip: Trip;
}

/** The road band above and the graph below, for one canvas size. */
function layout(sketch: p5, trip: Trip, plotted: TripGraph) {
  const { height, width } = sketch;
  const reach = tripReach(trip);
  const values = tripReach(trip, plotted);
  const valueSpan = Math.max(values.highest - values.lowest, 1);
  const span = Math.max(reach.highest - reach.lowest, 1);
  const margin = width * 0.08;
  const road: Road = {
    height: height * 0.42,
    origin: margin - (reach.lowest / span) * (width - 2 * margin),
    scale: (width - 2 * margin) / span,
    surface: height * 0.36,
    top: 0,
  };
  const pad = valueSpan * 0.08;
  const graph: Graph = {
    box: {
      height: height * 0.46,
      width: width - 2 * margin,
      x: margin,
      y: height * 0.48,
    },
    time: [0, tripDuration(trip)],
    value: [values.lowest - pad, values.highest + pad],
  };
  return { graph, road, span, valueSpan };
}

/** The spacing of the distance posts for a road of `span` metres, so about ten stand along it. */
function postStep(span: number) {
  if (span > 60) {
    return 10;
  }
  return span > 20 ? 5 : 2;
}

/** A flag post on the road marking where the car was at one end of the interval. */
function paintFlag(sketch: p5, road: Road, metres: number, color: string) {
  const x = roadX(road, metres);
  sketch.push();
  sketch.stroke(color);
  sketch.strokeWeight(3);
  sketch.line(
    x,
    road.surface + road.height * 0.12,
    x,
    road.surface - road.height * 0.42
  );
  sketch.noStroke();
  sketch.fill(color);
  sketch.triangle(
    x,
    road.surface - road.height * 0.42,
    x + road.height * 0.12,
    road.surface - road.height * 0.37,
    x,
    road.surface - road.height * 0.32
  );
  sketch.pop();
}

/**
 * Draws one moment of the trip: the car on the road with flags where it
 * stood at the interval's two ends, and the position-time graph with the
 * secant through those two points, whose slope is the average velocity.
 */
function secantProgram(sketch: p5, read: () => SecantFrame) {
  let time = 0;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const { graph: plotted, interval, trip } = read();
    const duration = tripDuration(trip);
    if (sketch.isLooping()) {
      time = advanceRun(time, sketch.deltaTime / 1000, {
        duration,
        hold: HOLD_SECONDS,
        rate: PLAY_RATE,
      });
    } else if (time === 0) {
      time = duration;
    }
    const now = shownTime(time, duration);
    const { graph, road, span, valueSpan } = layout(sketch, trip, plotted);
    sketch.background(getColor("ZINC", 950));
    paintLandscape(sketch, road);
    const step = postStep(span);
    paintRoad(sketch, road, {
      length: tripReach(trip).highest,
      start: Math.ceil(tripReach(trip).lowest / step) * step,
      step,
    });
    const [start, end] = interval;
    const from = tripState(trip, start).position;
    const to = tripState(trip, end).position;
    paintFlag(sketch, road, from, PLOT_COLORS.teal);
    paintFlag(sketch, road, to, PLOT_COLORS.violet);
    const carLength = Math.min(road.height * 0.55, sketch.width * 0.14);
    const state = tripState(trip, now);
    paintCar(sketch, road, {
      color: PLOT_COLORS.orange,
      length: carLength,
      rear: roadX(road, state.position) - carLength / 2,
    });

    paintGraph(sketch, graph, {
      time: duration > 12 ? 2 : 1,
      value: plotted === "position" ? step : postStep(valueSpan * 5) / 5,
    });
    const curve = (moment: number) => tripValue(trip, plotted, moment);
    const first = tripValue(trip, plotted, start);
    const last = tripValue(trip, plotted, end);
    paintCurve(sketch, graph, curve, {
      color: fade(getColor("SLATE", 300), 0.35),
      until: duration,
      weight: 2,
    });
    paintCurve(sketch, graph, curve, {
      color: PLOT_COLORS.orange,
      until: now,
      weight: 3,
    });
    const { rate } = changeOver(trip, plotted, interval);
    paintSlopeLine(sketch, graph, { time: start, value: first }, rate, {
      color: fade(PLOT_COLORS.amber, 0.6),
      weight: 1.5,
    });
    dashed(
      sketch,
      { x: graphX(graph, start), y: graphY(graph, first) },
      { x: graphX(graph, end), y: graphY(graph, first) },
      { color: PLOT_COLORS.teal, dash: 4, weight: 2 }
    );
    dashed(
      sketch,
      { x: graphX(graph, end), y: graphY(graph, first) },
      { x: graphX(graph, end), y: graphY(graph, last) },
      { color: PLOT_COLORS.violet, dash: 4, weight: 2 }
    );
    sketch.push();
    sketch.stroke(PLOT_COLORS.amber);
    sketch.strokeWeight(3);
    sketch.line(
      graphX(graph, start),
      graphY(graph, first),
      graphX(graph, end),
      graphY(graph, last)
    );
    sketch.pop();
    paintGraphDot(
      sketch,
      graph,
      { time: start, value: first },
      PLOT_COLORS.teal
    );
    paintGraphDot(
      sketch,
      graph,
      { time: end, value: last },
      PLOT_COLORS.violet
    );
    paintGraphDot(
      sketch,
      graph,
      { time: now, value: curve(now) },
      PLOT_COLORS.orange
    );
    vignette(sketch, 0.3);
  };
}

interface CarTripSecantSlopeLabProps {
  description: ReactNode;
  /** The graph drawn under the road: position, whose secant slope is the average velocity, or velocity, whose secant slope is the average acceleration. */
  graph?: TripGraph;
  labels: {
    /** The change over the interval: displacement on a position graph, change of velocity on a velocity graph. */
    change: ReactNode;
    chooseInterval: string;
    elapsed: ReactNode;
    /** The secant slope: average velocity, or average acceleration. */
    rate: ReactNode;
    viewLabel: string;
  };
  title: ReactNode;
  /** The trip the car drives. */
  trip?: Trip;
}

/**
 * A car drives a trip along a straight road while its position-time or
 * velocity-time graph draws below. The learner picks a time interval: flags
 * mark where the car was at its two ends, and the secant between those two
 * points on the graph has the average velocity, or on a velocity graph the
 * average acceleration, as its slope.
 */
export function CarTripSecantSlopeLab({
  description,
  graph = "position",
  labels,
  title,
  trip = "commute",
}: CarTripSecantSlopeLabProps) {
  const intervals = tripIntervals(trip);
  const [chosen, setChosen] = useState(intervals.length - 1);
  const interval = intervals[chosen] ?? intervals[0];
  const measure = useQuantity();
  const average = changeOver(trip, graph, interval);
  const symbols =
    graph === "position"
      ? {
          change: "\\Delta x",
          changeUnit: "\\text{ m}",
          rate: "\\bar{v}",
          rateUnit: "\\text{ m/s}",
        }
      : {
          change: "\\Delta v",
          changeUnit: "\\text{ m/s}",
          rate: "\\bar{a}",
          rateUnit: "\\text{ m/s}^2",
        };

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseInterval}
          gridColumns="4"
          onValueChange={(value) => {
            const index = Number(value);
            if (Number.isInteger(index) && intervals[index]) {
              setChosen(index);
            }
          }}
          type="single"
          value={String(chosen)}
          variant="outline"
        >
          {Arr.map(intervals, ([start, end], index) => (
            <ToggleGroupItem key={`${start}-${end}`} value={String(index)}>
              <InlineMath math={`[${start},\\,${end}]\\text{ s}`} />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={secantProgram}
          state={{ graph, interval, trip }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.change}
            value={
              <InlineMath
                math={`${symbols.change}=${measure(average.change, symbols.changeUnit, 1)}`}
              />
            }
          />
          <VisualFactTabular
            label={labels.elapsed}
            value={
              <InlineMath
                math={`\\Delta t=${measure(average.elapsed, "\\text{ s}", 1)}`}
              />
            }
          />
          <VisualFactTabular
            label={labels.rate}
            value={
              <InlineMath
                math={`${symbols.rate}=${measure(average.rate, symbols.rateUnit, 2)}`}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
