import { caption } from "@repo/design-system/components/contents/physics/canvas/caption";
import {
  fade,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import {
  paintCar,
  paintLandscape,
  paintRoad,
  type Road,
} from "@repo/design-system/components/contents/physics/canvas/scene";
import { motionAreas } from "@repo/design-system/components/contents/physics/measure/data";
import {
  useQuantity,
  useReading,
} from "@repo/design-system/components/contents/simulation/quantity";
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
import { MATERIAL } from "@repo/design-system/lib/material";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import type p5 from "p5";
import type { ReactNode } from "react";

/** Wall seconds per second of the motion. */
const PACE = 0.5;

/** Wall seconds the last frame holds before the drive starts again. */
const HOLD_SECONDS = 2;

/** One stretch of the motion: how long it lasts and the velocity it ends at. */
const StretchSchema = Schema.Struct({
  duration: Schema.Finite,
  end: Schema.Finite,
});

/** What the sketch reads on every frame. */
const AreaFrameSchema = Schema.Struct({
  labels: Schema.Array(Schema.String),
  start: Schema.Finite,
  stretches: Schema.Array(StretchSchema),
});
type AreaFrame = typeof AreaFrameSchema.Type;

/** The velocity and the displacement `time` seconds into the motion. */
function stateAt(frame: AreaFrame, time: number) {
  let left = time;
  let from = frame.start;
  let travelled = 0;
  for (const stretch of frame.stretches) {
    const part = Math.min(left, stretch.duration);
    const velocity = from + ((stretch.end - from) * part) / stretch.duration;
    travelled += ((from + velocity) / 2) * part;
    if (left <= stretch.duration) {
      return { travelled, velocity };
    }
    left -= stretch.duration;
    from = stretch.end;
  }
  return { travelled, velocity: from };
}

/**
 * Draws one moment: the car on the road at its displacement from the start
 * post, and below it the velocity-time graph with each stretch's area shaded,
 * above the axis forward and below it backward, each area labelled, drawn as
 * far as the clock has got.
 */
function areaProgram(sketch: p5, read: () => AreaFrame) {
  // The first frame is the finished drive, so a paused card shows every area.
  let clock =
    Arr.reduce(read().stretches, 0, (sum, stretch) => sum + stretch.duration) *
    PACE;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const frame = read();
    const total = Arr.reduce(
      frame.stretches,
      0,
      (sum, stretch) => sum + stretch.duration
    );
    if (sketch.isLooping()) {
      clock =
        (clock + Math.min(sketch.deltaTime / 1000, 0.1)) %
        (total * PACE + HOLD_SECONDS);
    }
    const time = Math.min(clock / PACE, total);
    const { height, width } = sketch;
    const areas = motionAreas(frame.start, frame.stretches);
    const farthest = Math.max(
      ...Arr.scan(areas.areas, 0, (sum, area) => sum + area)
    );
    const length = Math.ceil(farthest / 20) * 20;
    const road: Road = {
      height: height * 0.42,
      origin: width * 0.08,
      scale: (width * 0.84) / length,
      surface: height * 0.38,
      top: 0,
    };
    paintLandscape(sketch, road);
    paintRoad(sketch, road, { length, step: 20 });
    const now = stateAt(frame, time);
    // On a road this long a real car would be a speck, so it is drawn larger than life, its front at its place.
    const car = Math.max(4.5, length / 12);
    paintCar(sketch, road, {
      color: MATERIAL.carPaint,
      facing: now.velocity >= 0 ? 1 : -1,
      length: car,
      rear: now.velocity >= 0 ? now.travelled - car : now.travelled,
    });
    const graph = {
      bottom: height * 0.94,
      left: width * 0.1,
      right: width * 0.94,
      top: height * 0.5,
    };
    const fastest = Math.max(
      ...Arr.map(frame.stretches, (stretch) => Math.abs(stretch.end)),
      Math.abs(frame.start)
    );
    const lowest = Math.min(
      0,
      ...Arr.map(frame.stretches, (stretch) => stretch.end)
    );
    const x = (seconds: number) =>
      graph.left + (seconds / total) * (graph.right - graph.left);
    const y = (velocity: number) =>
      graph.bottom -
      ((velocity - lowest * 1.2) / (fastest * 1.15 - lowest * 1.2)) *
        (graph.bottom - graph.top);
    sketch.noStroke();
    sketch.fill(fade(getColor("ZINC", 950), 0.75));
    sketch.rect(
      graph.left - 12,
      graph.top - 8,
      graph.right - graph.left + 22,
      graph.bottom - graph.top + 16,
      8
    );
    let from = frame.start;
    let at = 0;
    Arr.forEach(frame.stretches, (stretch, index) => {
      const shown = Math.min(Math.max(time - at, 0), stretch.duration);
      const reached = from + ((stretch.end - from) * shown) / stretch.duration;
      const backward = (areas.areas[index] ?? 0) < 0;
      sketch.noStroke();
      sketch.fill(fade(backward ? PLOT_COLORS.pink : PLOT_COLORS.teal, 0.45));
      sketch.beginShape();
      sketch.vertex(x(at), y(0));
      sketch.vertex(x(at), y(from));
      sketch.vertex(x(at + shown), y(reached));
      sketch.vertex(x(at + shown), y(0));
      sketch.endShape(sketch.CLOSE);
      sketch.stroke(getColor("WHITE"));
      sketch.strokeWeight(2.5);
      sketch.line(x(at), y(from), x(at + shown), y(reached));
      if (shown >= stretch.duration) {
        caption(
          sketch,
          frame.labels[index] ?? "",
          {
            x: x(at + stretch.duration / 2),
            y: (y(0) + y((from + stretch.end) / 2)) / 2,
          },
          {
            align: "center",
            baseline: "middle",
            color: getColor("WHITE"),
            size: 12,
          }
        );
      }
      at += stretch.duration;
      from = stretch.end;
    });
    sketch.stroke(fade(getColor("WHITE"), 0.7));
    sketch.strokeWeight(1.5);
    sketch.line(graph.left, y(0), graph.right, y(0));
    sketch.line(graph.left, graph.bottom, graph.left, graph.top);
    vignette(sketch, 0.25);
  };
}

interface MotionAreaLabProps {
  description: ReactNode;
  labels: {
    displacement: ReactNode;
    distance: ReactNode;
    viewLabel: string;
  };
  /** The velocity the motion starts at, in m s⁻¹. */
  start: number;
  /** Each stretch of the motion: its duration in seconds and the velocity it ends at, in m s⁻¹, changing steadily. */
  stretches: readonly { readonly duration: number; readonly end: number }[];
  title: ReactNode;
}

/**
 * A car drives a straight road through stretches of steady speeding up,
 * steady speed and slowing down, and its velocity-time graph fills in below
 * it. Each shaded area is the displacement in that stretch; below the axis
 * the car moves backward, so that area counts negative. The car's place from
 * the start post is the sum of the signed areas, while the distance it
 * covered adds them all as positive.
 */
export function MotionAreaLab({
  description,
  labels,
  start,
  stretches,
  title,
}: MotionAreaLabProps) {
  const quantity = useQuantity();
  const reading = useReading();
  const areas = motionAreas(start, stretches);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={areaProgram}
          state={{
            labels: Arr.map(areas.areas, (area) => `${reading(area, 0)} m`),
            start,
            stretches,
          }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.distance}
            value={
              <InlineMath math={quantity(areas.distance, "\\text{ m}", 1)} />
            }
          />
          <VisualFactTabular
            label={labels.displacement}
            value={
              <InlineMath
                math={quantity(areas.displacement, "\\text{ m}", 1)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
