import {
  advanceRun,
  shownTime,
} from "@repo/design-system/components/contents/physics/canvas/clock";
import {
  arrow,
  createBackdrop,
  fade,
  gradientRect,
  mix,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import {
  fitPlan,
  type Plan,
  paintWalker,
  planPoint,
} from "@repo/design-system/components/contents/physics/canvas/town";
import {
  STRAIGHT,
  type TrackStop,
  TrackStopSchema,
  trackDisplacement,
  trackPlace,
} from "@repo/design-system/components/contents/physics/kinematics/track/lap";
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
import { MATERIAL } from "@repo/design-system/lib/material";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** The kerb radius and the width of one lane, in metres (World Athletics: 36.50 m and 1.22 m, eight lanes). */
const KERB = 36.5;
const LANE = 1.22;
const LANES = 8;

/** How long a run to the chosen stop plays, in wall seconds per 100 m. */
const PLAY_SECONDS_PER_HUNDRED = 2;

/** How long the finished run rests before it starts again, in wall seconds. */
const HOLD_SECONDS = 2;

/** What the sketch reads on every frame: how far the runner goes. */
interface TrackFrame {
  readonly stop: TrackStop;
}

/** The plan that fits the whole stadium. */
function stadiumPlan(sketch: p5): Plan {
  const reach = KERB + LANE * LANES + 6;
  return fitPlan(
    sketch,
    {
      east: [-STRAIGHT / 2 - reach, STRAIGHT / 2 + reach],
      north: [-reach, reach],
    },
    sketch.width * 0.02
  );
}

/** A stadium outline (two straights and two half circles) at `radius` metres from the bend centres. */
function stadium(sketch: p5, plan: Plan, radius: number) {
  const left = planPoint(plan, { east: -STRAIGHT / 2, north: 0 });
  const right = planPoint(plan, { east: STRAIGHT / 2, north: 0 });
  const r = radius * plan.scale;
  sketch.rect(left.x, left.y - r, right.x - left.x, 2 * r);
  sketch.circle(left.x, left.y, 2 * r);
  sketch.circle(right.x, right.y, 2 * r);
}

/** The lane line at `radius`, as straights and arcs, stroked white. */
function laneLine(sketch: p5, plan: Plan, radius: number) {
  const left = planPoint(plan, { east: -STRAIGHT / 2, north: 0 });
  const right = planPoint(plan, { east: STRAIGHT / 2, north: 0 });
  const r = radius * plan.scale;
  sketch.line(left.x, left.y - r, right.x, right.y - r);
  sketch.line(left.x, left.y + r, right.x, right.y + r);
  sketch.arc(left.x, left.y, 2 * r, 2 * r, Math.PI / 2, (3 * Math.PI) / 2);
  sketch.arc(right.x, right.y, 2 * r, 2 * r, -Math.PI / 2, Math.PI / 2);
}

/** The stadium from above: concrete apron, the red track with its eight lanes, the grass infield, and the finish line. */
function paintStadium(sketch: p5, plan: Plan) {
  gradientRect(
    sketch,
    { height: sketch.height, width: sketch.width, x: 0, y: 0 },
    [
      [0, mix(MATERIAL.pavement, getColor("WHITE"), 0.1)],
      [1, mix(MATERIAL.pavement, getColor("BLACK"), 0.2)],
    ]
  );
  sketch.noStroke();
  sketch.fill(mix(MATERIAL.athleticsTrack, getColor("BLACK"), 0.15));
  stadium(sketch, plan, KERB + LANE * LANES + 0.6);
  sketch.fill(MATERIAL.athleticsTrack);
  stadium(sketch, plan, KERB + LANE * LANES);
  sketch.fill(MATERIAL.kerb);
  stadium(sketch, plan, KERB);
  sketch.fill(MATERIAL.grass);
  stadium(sketch, plan, KERB - 0.4);
  sketch.noFill();
  sketch.stroke(fade(MATERIAL.roadPaint, 0.85));
  sketch.strokeWeight(Math.max(1, plan.scale * 0.08));
  for (let lane = 1; lane <= LANES; lane += 1) {
    laneLine(sketch, plan, KERB + LANE * lane);
  }
  const finish = planPoint(plan, { east: STRAIGHT / 2, north: -KERB });
  const outer = planPoint(plan, {
    east: STRAIGHT / 2,
    north: -KERB - LANE * LANES,
  });
  sketch.strokeWeight(Math.max(2, plan.scale * 0.3));
  sketch.stroke(MATERIAL.roadPaint);
  sketch.line(finish.x, finish.y, outer.x, outer.y);
  sketch.noStroke();
}

/**
 * Draws one moment of the run from above: the stadium, the path run so far
 * in amber, the runner with the direction of running in teal, and the
 * displacement from the start in violet, which shrinks to nothing as the
 * lap closes.
 */
function trackProgram(sketch: p5, read: () => TrackFrame) {
  let distance = Number.POSITIVE_INFINITY;
  const backdrop = createBackdrop();
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const { stop } = read();
    if (sketch.isLooping()) {
      distance = advanceRun(
        Math.min(distance, stop * 2),
        sketch.deltaTime / 1000,
        {
          duration: stop,
          hold: HOLD_SECONDS,
          rate: 100 / PLAY_SECONDS_PER_HUNDRED,
        }
      );
    }
    const run = shownTime(distance, stop);
    const plan = stadiumPlan(sketch);
    backdrop(sketch, "stadium", (layer) => paintStadium(layer, plan));
    const weight = Math.max(3, plan.scale * 0.9);
    sketch.push();
    sketch.noFill();
    sketch.stroke(PLOT_COLORS.amber);
    sketch.strokeWeight(weight);
    sketch.beginShape();
    for (let step = 0; step <= 160; step += 1) {
      const place = trackPlace((run * step) / 160);
      const point = planPoint(plan, { east: place.x, north: place.y });
      sketch.vertex(point.x, point.y);
    }
    sketch.endShape();
    sketch.pop();
    const start = trackPlace(0);
    const here = trackPlace(run);
    const startPoint = planPoint(plan, { east: start.x, north: start.y });
    const herePoint = planPoint(plan, { east: here.x, north: here.y });
    arrow(sketch, startPoint, herePoint, {
      color: PLOT_COLORS.violet,
      head: Math.max(12, weight * 3),
      weight: weight * 0.9,
    });
    const ahead = 14 * plan.scale;
    arrow(
      sketch,
      herePoint,
      {
        x: herePoint.x + Math.cos(here.heading) * ahead,
        y: herePoint.y - Math.sin(here.heading) * ahead,
      },
      {
        color: PLOT_COLORS.teal,
        head: Math.max(10, weight * 2.4),
        weight: weight * 0.8,
      }
    );
    paintWalker(
      sketch,
      herePoint,
      Math.max(12, plan.scale * 2.2),
      PLOT_COLORS.pink
    );
    vignette(sketch, 0.3);
  };
}

interface RunningTrackDisplacementLabProps {
  description: ReactNode;
  labels: {
    averageVelocity: ReactNode;
    chooseDistance: string;
    displacement: ReactNode;
    distance: ReactNode;
    time: ReactNode;
    viewLabel: string;
  };
  /** The runner's steady speed, in m/s. */
  speed: number;
  title: ReactNode;
}

/**
 * A runner on lane 1 of a 400 m athletics track, seen from above. The
 * learner stops the run at 100, 200, 300 or 400 m: the path length grows by
 * the same step each time, while the displacement from the start grows,
 * shrinks, and vanishes after a full lap, and with it the average velocity.
 */
export function RunningTrackDisplacementLab({
  description,
  labels,
  speed,
  title,
}: RunningTrackDisplacementLabProps) {
  const [stop, setStop] = useState<TrackStop>(200);
  const quantity = useQuantity();
  const isStop = Schema.is(TrackStopSchema);
  const displacement = trackDisplacement(stop);
  const time = stop / speed;

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseDistance}
          gridColumns="4"
          onValueChange={(value) => {
            const next = Number(value);
            if (isStop(next)) {
              setStop(next);
            }
          }}
          type="single"
          value={String(stop)}
          variant="outline"
        >
          {Arr.map(TrackStopSchema.literals, (option) => (
            <ToggleGroupItem key={option} value={String(option)}>
              <InlineMath math={`${option}\\text{ m}`} />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={trackProgram}
          state={{ stop }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.distance}
            value={<InlineMath math={quantity(stop, "\\text{ m}", 0)} />}
          />
          <VisualFactTabular
            label={labels.displacement}
            value={
              <InlineMath math={quantity(displacement, "\\text{ m}", 1)} />
            }
          />
          <VisualFactTabular
            label={labels.time}
            value={<InlineMath math={quantity(time, "\\text{ s}", 1)} />}
          />
          <VisualFactTabular
            label={labels.averageVelocity}
            value={
              <InlineMath
                math={quantity(displacement / time, "\\text{ m/s}", 2)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
