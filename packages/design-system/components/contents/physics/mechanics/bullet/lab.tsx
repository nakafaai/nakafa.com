import { caption } from "@repo/design-system/components/contents/physics/canvas/caption";
import {
  fade,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { embedAndSlide } from "@repo/design-system/components/contents/physics/mechanics/force";
import {
  paintBlock,
  paintRoom,
} from "@repo/design-system/components/contents/physics/mechanics/stage";
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
import { Schema } from "effect";
import type p5 from "p5";
import type { ReactNode } from "react";

/** Wall seconds the bullet takes to reach the block. */
const FLIGHT_SECONDS = 0.6;

/** Wall seconds the block holds at rest before the shot repeats. */
const HOLD_SECONDS = 1.8;

/** What the sketch reads on every frame. */
const BulletFrameSchema = Schema.Struct({
  distance: Schema.Finite,
  mark: Schema.String,
  time: Schema.Finite,
});
type BulletFrame = typeof BulletFrameSchema.Type;

/**
 * Draws one moment: the bullet flying in from the left, the block with the
 * bullet in it sliding to rest at the pace a steady deceleration gives, a
 * metre scale on the floor, and the stopping distance marked.
 */
function bulletProgram(sketch: p5, read: () => BulletFrame) {
  // The first frame is the finished state, so a paused card still shows the whole result.
  let clock = FLIGHT_SECONDS + read().time;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const frame = read();
    const cycle = FLIGHT_SECONDS + frame.time + HOLD_SECONDS;
    if (sketch.isLooping()) {
      clock = (clock + Math.min(sketch.deltaTime / 1000, 0.1)) % cycle;
    }
    const { height, width } = sketch;
    const floor = height * 0.66;
    paintRoom(sketch, floor);
    const start = width * 0.24;
    const metre = (width * 0.62) / Math.max(frame.distance * 1.15, 0.5);
    const sliding = Math.min(Math.max(clock - FLIGHT_SECONDS, 0), frame.time);
    const covered = frame.distance * (1 - (1 - sliding / frame.time) ** 2);
    const size = Math.min(width, height) * 0.12;
    const left = start + covered * metre;
    if (clock < FLIGHT_SECONDS) {
      const x =
        width * 0.02 + (start - width * 0.02) * (clock / FLIGHT_SECONDS);
      sketch.noStroke();
      sketch.fill(MATERIAL.brass);
      sketch.rect(x - 14, floor - size * 0.5 - 3, 14, 6, 3);
    }
    paintBlock(
      sketch,
      { base: floor, height: size, left, width: size },
      MATERIAL.oak
    );
    sketch.stroke(fade(getColor("WHITE"), 0.6));
    sketch.strokeWeight(1);
    for (let mark = 0; mark <= Math.ceil(frame.distance * 1.15); mark += 1) {
      const x = start + mark * metre;
      sketch.line(x, floor + 8, x, floor + 16);
    }
    sketch.stroke(PLOT_COLORS.amber);
    sketch.strokeWeight(2.5);
    const end = start + frame.distance * metre;
    sketch.line(start, floor + 28, end, floor + 28);
    sketch.line(start, floor + 22, start, floor + 34);
    sketch.line(end, floor + 22, end, floor + 34);
    caption(
      sketch,
      frame.mark,
      { x: (start + end) / 2, y: floor + 38 },
      {
        align: "center",
        baseline: "top",
        color: PLOT_COLORS.amber,
        size: 13,
      }
    );
    vignette(sketch, 0.3);
  };
}

interface BulletBlockLabProps {
  /** The mass of the wooden block, in kilograms. */
  blockMass: number;
  /** The mass of the bullet, in grams. */
  bulletMass: number;
  description: NonNullable<ReactNode>;
  /** The friction between the block and the floor, in newtons. */
  friction: number;
  labels: {
    deceleration: ReactNode;
    distance: ReactNode;
    lost: ReactNode;
    velocity: ReactNode;
    viewLabel: string;
  };
  /** The bullet's speed, in m s⁻¹. */
  speed: number;
  title: NonNullable<ReactNode>;
}

/**
 * A bullet embeds in a wooden block resting on the floor, and the block
 * slides to a stop. The collision keeps momentum but not kinetic energy,
 * which is why the block starts slowly; then friction slows the bullet and
 * block together at a steady rate until they stop.
 */
export function BulletBlockLab({
  blockMass,
  bulletMass,
  description,
  friction,
  labels,
  speed,
  title,
}: BulletBlockLabProps) {
  const quantity = useQuantity();
  const reading = useReading();
  const motion = embedAndSlide({
    block: blockMass,
    bullet: bulletMass / 1000,
    friction,
    speed,
  });

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={bulletProgram}
          state={{
            distance: motion.distance,
            mark: `${reading(motion.distance, 2)} m`,
            time: motion.time,
          }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.velocity}
            value={
              <InlineMath
                math={quantity(motion.velocity, "\\text{ m s}^{-1}", 2)}
              />
            }
          />
          <VisualFactTabular
            label={labels.deceleration}
            value={
              <InlineMath
                math={quantity(motion.deceleration, "\\text{ m s}^{-2}", 2)}
              />
            }
          />
          <VisualFactTabular
            label={labels.distance}
            value={
              <InlineMath math={quantity(motion.distance, "\\text{ m}", 2)} />
            }
          />
          <VisualFactTabular
            label={labels.lost}
            value={
              <InlineMath math={quantity(motion.lostEnergy, "\\text{ J}", 0)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
