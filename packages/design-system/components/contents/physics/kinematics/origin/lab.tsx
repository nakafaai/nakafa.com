import {
  advanceRun,
  shownTime,
} from "@repo/design-system/components/contents/physics/canvas/clock";
import {
  arrow,
  dashed,
  fade,
  gradientRect,
  mix,
  vignette,
  withShadow,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import {
  type Graph,
  paintCurve,
  paintGraph,
  paintGraphDot,
} from "@repo/design-system/components/contents/physics/canvas/plot";
import {
  paintLandscape,
  paintRoad,
  type Road,
  roadX,
} from "@repo/design-system/components/contents/physics/canvas/scene";
import {
  LANDMARKS,
  type Landmark,
  LandmarkSchema,
  measuredFrom,
  RIDE_DURATION,
  ridePosition,
  rideSummary,
} from "@repo/design-system/components/contents/physics/kinematics/origin/street";
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
import { Array as Arr, Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** The stretch of street the scene shows, in metres east of the store. */
const STREET = { east: 62, west: -6 } as const;

/** How long the finished ride rests before it starts again, in wall seconds. */
const HOLD_SECONDS = 1.5;

/** What the sketch reads on every frame: the landmark taken as zero. */
const OriginFrameSchema = Schema.Struct({
  origin: LandmarkSchema,
});
type OriginFrame = typeof OriginFrameSchema.Type;

/** The street band above and the graph below, for one canvas size. */
function layout(sketch: p5) {
  const { height, width } = sketch;
  const margin = width * 0.06;
  const road: Road = {
    height: height * 0.5,
    origin:
      margin -
      STREET.west * ((width - 2 * margin) / (STREET.east - STREET.west)),
    scale: (width - 2 * margin) / (STREET.east - STREET.west),
    surface: height * 0.44,
    top: 0,
  };
  const graph: Graph = {
    box: {
      height: height * 0.38,
      width: width - 2 * margin,
      x: margin,
      y: height * 0.58,
    },
    time: [0, RIDE_DURATION],
    value: [-55, 60],
  };
  return { graph, road };
}

/** The store at zero: a low shop with an awning. */
function paintStore(sketch: p5, road: Road) {
  const x = roadX(road, LANDMARKS.store);
  const wide = road.scale * 9;
  const tall = road.height * 0.42;
  withShadow(
    sketch,
    { blur: 12, color: fade(getColor("BLACK"), 0.5), drop: 4 },
    () => {
      gradientRect(
        sketch,
        {
          height: tall,
          width: wide,
          x: x - wide / 2,
          y: road.surface - road.height * 0.08 - tall,
        },
        [
          [0, getColor("STONE", 600)],
          [1, mix(getColor("STONE", 600), getColor("BLACK"), 0.4)],
        ]
      );
    }
  );
  sketch.fill(PLOT_COLORS.teal);
  sketch.rect(
    x - wide * 0.55,
    road.surface - road.height * 0.08 - tall * 0.62,
    wide * 1.1,
    tall * 0.12,
    3
  );
  sketch.fill(mix(getColor("SLATE", 300), getColor("SLATE", 700), 0.5));
  sketch.rect(
    x - wide * 0.35,
    road.surface - road.height * 0.08 - tall * 0.42,
    wide * 0.7,
    tall * 0.34
  );
}

/** Rani's house: walls, a pitched roof and a lit window. */
function paintHouse(sketch: p5, road: Road) {
  const x = roadX(road, LANDMARKS.house);
  const wide = road.scale * 8;
  const tall = road.height * 0.32;
  const base = road.surface - road.height * 0.08;
  withShadow(
    sketch,
    { blur: 12, color: fade(getColor("BLACK"), 0.5), drop: 4 },
    () => {
      gradientRect(
        sketch,
        { height: tall, width: wide, x: x - wide / 2, y: base - tall },
        [
          [0, mix(getColor("STONE", 600), getColor("WHITE"), 0.55)],
          [1, mix(getColor("STONE", 600), getColor("WHITE"), 0.2)],
        ]
      );
    }
  );
  sketch.fill(mix(PLOT_COLORS.orange, getColor("BLACK"), 0.35));
  sketch.triangle(
    x - wide * 0.62,
    base - tall,
    x,
    base - tall - tall * 0.6,
    x + wide * 0.62,
    base - tall
  );
  sketch.fill(fade(PLOT_COLORS.amber, 0.85));
  sketch.rect(x - wide * 0.3, base - tall * 0.75, wide * 0.22, tall * 0.3);
  sketch.fill(getColor("ZINC", 900));
  sketch.rect(x + wide * 0.08, base - tall * 0.6, wide * 0.2, tall * 0.6);
}

/** The flagpole at 50 m. */
function paintPole(sketch: p5, road: Road) {
  const x = roadX(road, LANDMARKS.pole);
  const base = road.surface - road.height * 0.08;
  const tall = road.height * 0.7;
  sketch.fill(getColor("SLATE", 300));
  sketch.rect(x - 2, base - tall, 4, tall);
  sketch.fill(PLOT_COLORS.violet);
  sketch.rect(x + 2, base - tall, road.scale * 4, tall * 0.16);
  sketch.fill(getColor("SLATE", 600));
  sketch.rect(x - road.scale * 0.8, base - 6, road.scale * 1.6, 6);
}

/** A cyclist seen from the side, riding east, with the bike's wheels on the road. */
function paintCyclist(sketch: p5, road: Road, metres: number) {
  const x = roadX(road, metres);
  const wheel = road.height * 0.07;
  const ground = road.surface + road.height * 0.04;
  sketch.push();
  sketch.noStroke();
  sketch.fill(fade(getColor("BLACK"), 0.45));
  sketch.ellipse(x, ground + 2, wheel * 5, wheel * 0.6);
  sketch.noFill();
  sketch.stroke(getColor("ZINC", 100));
  sketch.strokeWeight(2.5);
  sketch.circle(x - wheel * 1.3, ground - wheel, wheel * 2);
  sketch.circle(x + wheel * 1.3, ground - wheel, wheel * 2);
  sketch.stroke(PLOT_COLORS.pink);
  sketch.strokeWeight(3);
  sketch.line(x - wheel * 1.3, ground - wheel, x, ground - wheel * 1.1);
  sketch.line(x, ground - wheel * 1.1, x + wheel * 1.3, ground - wheel);
  sketch.line(x, ground - wheel * 1.1, x - wheel * 0.3, ground - wheel * 2.3);
  sketch.line(
    x - wheel * 0.3,
    ground - wheel * 2.3,
    x + wheel * 1.0,
    ground - wheel * 2.2
  );
  sketch.stroke(getColor("ZINC", 900));
  sketch.strokeWeight(5);
  sketch.line(
    x - wheel * 0.3,
    ground - wheel * 2.4,
    x + wheel * 0.2,
    ground - wheel * 3.6
  );
  sketch.line(
    x + wheel * 0.2,
    ground - wheel * 3.6,
    x + wheel * 1.0,
    ground - wheel * 2.3
  );
  sketch.noStroke();
  sketch.fill(mix(getColor("STONE", 600), getColor("WHITE"), 0.4));
  sketch.circle(x + wheel * 0.35, ground - wheel * 4.15, wheel * 0.95);
  sketch.pop();
}

/**
 * Draws one moment of the ride: the street with its three landmarks, the
 * chosen origin ringed, an arrow from it to the cyclist whose length is the
 * cyclist's position, and the position-time graph, which moves up or down
 * as a whole when the origin changes.
 */
function originProgram(sketch: p5, read: () => OriginFrame) {
  let time = RIDE_DURATION;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const { origin } = read();
    if (sketch.isLooping()) {
      time = advanceRun(time, sketch.deltaTime / 1000, {
        duration: RIDE_DURATION,
        hold: HOLD_SECONDS,
        rate: 1.5,
      });
    }
    const now = shownTime(time, RIDE_DURATION);
    const { graph, road } = layout(sketch);
    sketch.background(getColor("ZINC", 950));
    paintLandscape(sketch, road);
    paintStore(sketch, road);
    paintHouse(sketch, road);
    paintPole(sketch, road);
    paintRoad(sketch, road, { length: 60, step: 10 });
    const zero = roadX(road, LANDMARKS[origin]);
    dashed(
      sketch,
      { x: zero, y: road.top + road.height * 0.08 },
      { x: zero, y: road.surface + road.height * 0.2 },
      { color: getColor("ZINC", 100), dash: 5, weight: 2 }
    );
    sketch.push();
    sketch.noFill();
    sketch.stroke(getColor("ZINC", 100));
    sketch.strokeWeight(3);
    sketch.circle(zero, road.surface + road.height * 0.12, 16);
    sketch.pop();
    const position = ridePosition(now);
    paintCyclist(sketch, road, position);
    arrow(
      sketch,
      { x: zero, y: road.surface + road.height * 0.12 },
      { x: roadX(road, position), y: road.surface + road.height * 0.12 },
      { color: PLOT_COLORS.amber, head: 12, weight: 4 }
    );

    paintGraph(sketch, graph, { time: 2, value: 10 });
    const measured = (moment: number) =>
      measuredFrom(origin, ridePosition(moment));
    paintCurve(sketch, graph, measured, {
      color: fade(getColor("SLATE", 300), 0.35),
      until: RIDE_DURATION,
      weight: 2,
    });
    paintCurve(sketch, graph, measured, {
      color: PLOT_COLORS.amber,
      until: now,
      weight: 3,
    });
    paintGraphDot(
      sketch,
      graph,
      { time: now, value: measured(now) },
      PLOT_COLORS.amber
    );
    vignette(sketch, 0.3);
  };
}

interface StreetOriginPositionLabProps {
  description: ReactNode;
  labels: {
    change: ReactNode;
    chooseOrigin: string;
    end: ReactNode;
    origins: Record<Landmark, ReactNode>;
    start: ReactNode;
    viewLabel: string;
  };
  title: ReactNode;
}

/**
 * A cyclist rides along a street with a store at zero, Rani's house at
 * 20 m, and a flagpole at 50 m, east positive. The learner takes any
 * landmark as the origin: every position the card reads and the whole
 * position-time graph shift by that landmark's coordinate, while the
 * cyclist and the change of position stay exactly the same.
 */
export function StreetOriginPositionLab({
  description,
  labels,
  title,
}: StreetOriginPositionLabProps) {
  const [origin, setOrigin] = useState<Landmark>("store");
  const measure = useQuantity();
  const summary = rideSummary(origin);
  const isLandmark = Schema.is(LandmarkSchema);
  const signed = (value: number) =>
    `${value > 0 ? "+" : ""}${measure(value, "\\text{ m}", 0)}`;

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseOrigin}
          gridColumns="3"
          onValueChange={(value) => {
            if (isLandmark(value)) {
              setOrigin(value);
            }
          }}
          type="single"
          value={origin}
          variant="outline"
        >
          {Arr.map(LandmarkSchema.literals, (landmark) => (
            <ToggleGroupItem key={landmark} value={landmark}>
              {labels.origins[landmark]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={originProgram}
          state={{ origin }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.start}
            value={<InlineMath math={signed(summary.start)} />}
          />
          <VisualFactTabular
            label={labels.end}
            value={<InlineMath math={signed(summary.end)} />}
          />
          <VisualFactTabular
            label={labels.change}
            value={<InlineMath math={`\\Delta x=${signed(summary.change)}`} />}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
