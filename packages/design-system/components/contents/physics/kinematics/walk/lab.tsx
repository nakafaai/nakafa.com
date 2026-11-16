import {
  advanceRun,
  shownTime,
} from "@repo/design-system/components/contents/physics/canvas/clock";
import {
  arrow,
  createBackdrop,
  dashed,
  fade,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import {
  fitPlan,
  type Plan,
  paintTown,
  paintWalker,
  planPoint,
} from "@repo/design-system/components/contents/physics/canvas/town";
import {
  type Walk,
  WalkSchema,
  walkCorners,
  walkDuration,
  walkReading,
} from "@repo/design-system/components/contents/physics/kinematics/walk/route";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
} from "@repo/design-system/components/visual/card";
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { P5Sketch } from "@repo/design-system/components/visual/sketch";
import { getColor } from "@repo/design-system/lib/color";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useMemo } from "react";

/** The length of one town block, street to street, in metres. */
const BLOCK = 100;

/** How long the walk plays, in wall seconds, whatever its real length. */
const PLAY_SECONDS = 8;

/** How long the finished walk rests before it starts again, in wall seconds. */
const HOLD_SECONDS = 2;

/** What the sketch reads on every frame: the walk. */
const WalkFrameSchema = Schema.Struct({
  walk: WalkSchema,
});
type WalkFrame = typeof WalkFrameSchema.Type;

/** The plan that fits the walk's corners, a block of town around them included. */
function walkPlan(sketch: p5, walk: Walk): Plan {
  const corners = walkCorners(walk);
  const easts = Arr.map(corners, (corner) => corner.east);
  const norths = Arr.map(corners, (corner) => corner.north);
  return fitPlan(
    sketch,
    {
      east: [
        Math.min(...easts) - BLOCK * 0.6,
        Math.max(...easts) + BLOCK * 0.6,
      ],
      north: [
        Math.min(...norths) - BLOCK * 0.6,
        Math.max(...norths) + BLOCK * 0.6,
      ],
    },
    sketch.width * 0.02
  );
}

/**
 * Draws one moment of the walk from above: the town, the path walked so far
 * in amber over the full route dashed, the walker, and the displacement
 * arrow in violet from the start straight to where the walker stands.
 */
function walkProgram(sketch: p5, read: () => WalkFrame) {
  let time = Number.POSITIVE_INFINITY;
  const backdrop = createBackdrop();
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const { walk } = read();
    const duration = walkDuration(walk);
    if (sketch.isLooping()) {
      time = advanceRun(Math.min(time, duration * 2), sketch.deltaTime / 1000, {
        duration,
        hold: HOLD_SECONDS,
        rate: duration / PLAY_SECONDS,
      });
    }
    const now = shownTime(time, duration);
    const plan = walkPlan(sketch, walk);
    backdrop(sketch, `${plan.originX} ${plan.originY} ${plan.scale}`, (layer) =>
      paintTown(layer, plan, BLOCK)
    );
    const corners = Arr.map(walkCorners(walk), (corner) =>
      planPoint(plan, corner)
    );
    const weight = Math.max(3, plan.scale * 6);
    Arr.forEach(corners, (corner, index) => {
      const next = corners[index + 1];
      if (next) {
        dashed(sketch, corner, next, {
          color: fade(getColor("WHITE"), 0.6),
          dash: 8,
          weight: weight * 0.5,
        });
      }
    });
    const reading = walkReading(walk, now);
    const walked = Arr.filter(walkCorners(walk), (_, index) => {
      const lengths = Arr.take(walk.legs, index);
      return (
        Arr.reduce(
          lengths,
          0,
          (sum, leg) => sum + Math.hypot(leg.east, leg.north)
        ) <=
        reading.walked + 1e-9
      );
    });
    sketch.push();
    sketch.noFill();
    sketch.stroke(PLOT_COLORS.amber);
    sketch.strokeWeight(weight);
    sketch.strokeJoin(sketch.ROUND);
    sketch.beginShape();
    Arr.forEach([...walked, reading.end], (place) => {
      const point = planPoint(plan, place);
      sketch.vertex(point.x, point.y);
    });
    sketch.endShape();
    sketch.pop();
    const start = planPoint(plan, { east: 0, north: 0 });
    const here = planPoint(plan, reading.end);
    arrow(sketch, start, here, {
      color: PLOT_COLORS.violet,
      head: Math.max(12, weight * 2.4),
      weight: weight * 0.9,
    });
    sketch.push();
    sketch.noFill();
    sketch.stroke(PLOT_COLORS.teal);
    sketch.strokeWeight(3);
    sketch.circle(start.x, start.y, Math.max(16, weight * 4));
    sketch.pop();
    paintWalker(sketch, here, Math.max(14, plan.scale * 14), PLOT_COLORS.pink);
    vignette(sketch, 0.3);
  };
}

interface CityWalkDisplacementLabProps {
  description: ReactNode;
  labels: {
    averageSpeed: ReactNode;
    averageVelocity: ReactNode;
    displacement: ReactNode;
    distance: ReactNode;
    time: ReactNode;
    viewLabel: string;
  };
  /** The straight legs of the walk, east and north in metres, along the town's 100 m streets. */
  legs: Walk["legs"];
  /** The walking pace, in m/s. */
  pace: number;
  title: ReactNode;
}

/**
 * A walk through a town seen from a drone: the walker follows the streets
 * leg by leg while the card adds up the path length and draws the
 * displacement as one straight arrow from the start. A detour makes the path
 * longer than the displacement; a loop back home makes the displacement,
 * and the average velocity, zero.
 */
export function CityWalkDisplacementLab({
  description,
  labels,
  legs,
  pace,
  title,
}: CityWalkDisplacementLabProps) {
  const quantity = useQuantity();
  const walk = useMemo(
    () => Schema.decodeSync(WalkSchema)({ legs, pace }),
    [legs, pace]
  );
  const end = walkReading(walk, walkDuration(walk));

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={walkProgram}
          state={{ walk }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.distance}
            value={<InlineMath math={quantity(end.walked, "\\text{ m}", 0)} />}
          />
          <VisualFactTabular
            label={labels.displacement}
            value={
              <InlineMath math={quantity(end.displacement, "\\text{ m}", 0)} />
            }
          />
          <VisualFactTabular
            label={labels.time}
            value={<InlineMath math={quantity(end.elapsed, "\\text{ s}", 0)} />}
          />
          <VisualFactTabular
            label={labels.averageSpeed}
            value={
              <InlineMath
                math={quantity(end.averageSpeed, "\\text{ m/s}", 2)}
              />
            }
          />
          <VisualFactTabular
            label={labels.averageVelocity}
            value={
              <InlineMath
                math={quantity(end.averageVelocity, "\\text{ m/s}", 2)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
