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
  withShadow,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import {
  fitPlan,
  planPoint,
} from "@repo/design-system/components/contents/physics/canvas/town";
import {
  paintFerry,
  paintSea,
} from "@repo/design-system/components/contents/physics/vector/bearing/sea";
import {
  type Course,
  CoursesSchema,
  voyageCorners,
  voyageDisplacement,
  voyagePoint,
} from "@repo/design-system/components/contents/physics/vector/bearing/voyage";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
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
import { type ReactNode, useMemo, useState } from "react";

/** How long the voyage plays, in wall seconds. */
const PLAY_SECONDS = 6;

/** How long the ship waits at the end before it sails again, in wall seconds. */
const HOLD_SECONDS = 1.5;

/**
 * Draws the voyage from above: the sea and its islands, the dashed route,
 * the ferry sailing it, the bearing of the last leg measured from north, the
 * displacement from the harbour (violet) and its east (teal) and north
 * (amber) components.
 */
function voyageProgram(
  sketch: p5,
  read: () => { readonly courses: readonly [Course, ...Course[]] }
) {
  let time = Number.POSITIVE_INFINITY;
  const backdrop = createBackdrop();
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const { courses } = read();
    const corners = voyageCorners(courses);
    const moved = voyageDisplacement(courses);
    const easts = Arr.map(corners, (corner) => corner.east);
    const norths = Arr.map(corners, (corner) => corner.north);
    const span = Math.max(moved.path * 0.12, 1);
    const plan = fitPlan(
      sketch,
      {
        east: [Math.min(...easts) - span, Math.max(...easts) + span],
        north: [Math.min(...norths) - span, Math.max(...norths) + span],
      },
      24
    );
    const route = Arr.map(corners, (corner) => planPoint(plan, corner));
    const harbour = planPoint(plan, { east: 0, north: 0 });
    backdrop(
      sketch,
      Arr.join(
        Arr.map(route, (point) => `${point.x.toFixed(0)},${point.y.toFixed(0)}`),
        ";"
      ),
      (layer) => paintSea(layer, harbour, route)
    );
    Arr.forEach(route, (point, index) => {
      const previous = route[index - 1];
      if (previous) {
        dashed(sketch, previous, point, {
          color: fade(getColor("WHITE"), 0.55),
          dash: 7,
          weight: 2,
        });
      }
    });
    const last = courses[courses.length - 1] ?? courses[0];
    const start = route[route.length - 2] ?? harbour;
    const radius = Math.min(sketch.width, sketch.height) * 0.09;
    dashed(sketch, start, { x: start.x, y: start.y - radius * 1.6 }, {
      color: fade(getColor("WHITE"), 0.8),
      dash: 4,
      weight: 1.5,
    });
    sketch.push();
    sketch.noFill();
    sketch.stroke(fade(getColor("WHITE"), 0.9));
    sketch.strokeWeight(2.5);
    sketch.arc(
      start.x,
      start.y,
      radius * 2,
      radius * 2,
      -Math.PI / 2,
      -Math.PI / 2 + (((last.bearing % 360) + 360) % 360) * (Math.PI / 180)
    );
    sketch.pop();
    const head = Math.max(11, radius * 0.22);
    const end = planPoint(plan, { east: moved.east, north: moved.north });
    const corner = planPoint(plan, { east: moved.east, north: 0 });
    arrow(sketch, harbour, corner, { color: PLOT_COLORS.teal, head, weight: 3.5 });
    arrow(sketch, corner, end, { color: PLOT_COLORS.amber, head, weight: 3.5 });
    arrow(sketch, harbour, end, { color: PLOT_COLORS.violet, head, weight: 4.5 });
    if (sketch.isLooping()) {
      time = advanceRun(Math.min(time, moved.path), sketch.deltaTime / 1000, {
        duration: moved.path,
        hold: HOLD_SECONDS,
        rate: moved.path / PLAY_SECONDS,
      });
    }
    const sailed = shownTime(time, moved.path);
    const ship = planPoint(plan, voyagePoint(courses, sailed));
    let bearing = courses[0].bearing;
    let left = sailed;
    for (const course of courses) {
      bearing = course.bearing;
      if (left <= course.distance) {
        break;
      }
      left -= course.distance;
    }
    withShadow(
      sketch,
      { blur: 8, color: fade(getColor("BLACK"), 0.45), drop: 3 },
      () => {
        sketch.push();
        sketch.translate(ship.x, ship.y);
        sketch.rotate((bearing * Math.PI) / 180);
        paintFerry(sketch, Math.max(30, radius * 0.9));
        sketch.pop();
      }
    );
    vignette(sketch, 0.32);
  };
}

interface ShipBearingComponentLabProps {
  /** The legs of the voyage, distances in km and bearings in degrees; the learner turns the last leg's bearing. */
  courses: readonly Course[];
  description: ReactNode;
  labels: {
    bearing: ReactNode;
    bearingName: string;
    direction: ReactNode;
    distance: ReactNode;
    east: ReactNode;
    north: ReactNode;
    viewLabel: string;
  };
  title: ReactNode;
}

/**
 * A ferry leaves its harbour in legs, each a distance on a compass bearing.
 * The learner turns the bearing of the last leg, measured clockwise from
 * north: the east component takes the sine and the north component the
 * cosine, and both take the sign of the quadrant the ship heads into. The
 * card adds the legs by components into the displacement from the harbour.
 */
export function ShipBearingComponentLab({
  courses: plan,
  description,
  labels,
  title,
}: ShipBearingComponentLabProps) {
  const quantity = useQuantity();
  const decoded = useMemo(
    () => Schema.decodeUnknownSync(CoursesSchema)(plan),
    [plan]
  );
  const lastIndex = decoded.length - 1;
  const [bearing, setBearing] = useState(decoded[lastIndex]?.bearing ?? 0);
  const courses = Arr.map(decoded, (course, index) =>
    index === lastIndex ? { ...course, bearing } : course
  );
  const moved = voyageDisplacement(courses);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <LabSlider
          label={labels.bearing}
          max={359}
          min={0}
          name={labels.bearingName}
          onValueChange={setBearing}
          readout={<InlineMath math={quantity(bearing, "^\\circ", 0)} />}
          step={1}
          value={bearing}
        />
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={voyageProgram}
          state={{ courses }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.east}
            value={
              <InlineMath math={quantity(moved.east, "\\text{ km}", 2)} />
            }
          />
          <VisualFactTabular
            label={labels.north}
            value={
              <InlineMath math={quantity(moved.north, "\\text{ km}", 2)} />
            }
          />
          <VisualFactTabular
            label={labels.distance}
            value={
              <InlineMath math={quantity(moved.size, "\\text{ km}", 2)} />
            }
          />
          <VisualFactTabular
            label={labels.direction}
            value={
              <InlineMath math={quantity(moved.bearing, "^\\circ", 1)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
