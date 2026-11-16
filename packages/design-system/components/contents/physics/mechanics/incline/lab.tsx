import {
  mix,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { slideUp } from "@repo/design-system/components/contents/physics/mechanics/force";
import {
  force,
  paintRoom,
} from "@repo/design-system/components/contents/physics/mechanics/stage";
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
import { MATERIAL } from "@repo/design-system/lib/material";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Schema } from "effect";
import type p5 from "p5";
import type { ReactNode } from "react";

/** Wall seconds the block holds at its highest point before it starts again. */
const HOLD_SECONDS = 1.5;

/** What the sketch reads on every frame. */
const InclineFrameSchema = Schema.Struct({
  along: Schema.Finite,
  angle: Schema.Finite,
  deceleration: Schema.Finite,
  distance: Schema.Finite,
  friction: Schema.Finite,
  speed: Schema.Finite,
});
type InclineFrame = typeof InclineFrameSchema.Type;

/**
 * Draws one moment: the plane at its angle, the block sliding up it from the
 * bottom and slowing to rest at the distance a steady deceleration gives,
 * and while it rises the part of the weight down the slope and the friction
 * down the slope, drawn to scale from the block.
 */
function inclineProgram(sketch: p5, read: () => InclineFrame) {
  // The first frame shows the block partway up, so a paused card still shows the forces on it.
  let clock = (read().speed / read().deceleration) * 0.35;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const frame = read();
    const rise = frame.speed / frame.deceleration;
    if (sketch.isLooping()) {
      clock =
        (clock + Math.min(sketch.deltaTime / 1000, 0.1)) %
        (rise + HOLD_SECONDS);
    }
    const t = Math.min(clock, rise);
    const covered = frame.speed * t - 0.5 * frame.deceleration * t ** 2;
    const { height, width } = sketch;
    const floor = height * 0.88;
    paintRoom(sketch, floor);
    const turn = (frame.angle * Math.PI) / 180;
    const run = width * 0.7;
    const slope = Math.min(
      run / Math.cos(turn),
      (floor - height * 0.12) / Math.sin(turn)
    );
    const foot = { x: width * 0.24, y: floor };
    const metre = (slope * 0.8) / frame.distance;
    sketch.noStroke();
    sketch.fill(mix(MATERIAL.pine, getColor("BLACK"), 0.15));
    sketch.triangle(
      foot.x,
      foot.y,
      foot.x + slope * Math.cos(turn),
      foot.y,
      foot.x + slope * Math.cos(turn),
      foot.y - slope * Math.sin(turn)
    );
    const size = Math.min(width, height) * 0.09;
    const along = 0.06 * slope + covered * metre;
    sketch.push();
    sketch.translate(
      foot.x + along * Math.cos(turn),
      foot.y - along * Math.sin(turn)
    );
    sketch.rotate(-turn);
    sketch.fill(mix(MATERIAL.crateWood, getColor("WHITE"), 0.1));
    sketch.rect(-size / 2, -size, size, size, 3);
    sketch.pop();
    const centre = {
      x: foot.x + along * Math.cos(turn) - Math.sin(turn) * size * 0.5,
      y: foot.y - along * Math.sin(turn) - Math.cos(turn) * size * 0.5,
    };
    if (t < rise) {
      const newton = (slope * 0.16) / (frame.along + frame.friction);
      const down = { x: -Math.cos(turn), y: Math.sin(turn) };
      force(
        sketch,
        centre,
        {
          x: centre.x + down.x * frame.along * newton,
          y: centre.y + down.y * frame.along * newton,
        },
        PLOT_COLORS.pink,
        "W∥"
      );
      const base = {
        x: foot.x + along * Math.cos(turn),
        y: foot.y - along * Math.sin(turn),
      };
      force(
        sketch,
        base,
        {
          x: base.x + down.x * frame.friction * newton,
          y: base.y + down.y * frame.friction * newton,
        },
        PLOT_COLORS.orange,
        "f"
      );
    }
    vignette(sketch, 0.3);
  };
}

interface InclineSlideLabProps {
  /** The plane's angle to the horizontal, in degrees. */
  angle: number;
  description: ReactNode;
  /** The friction on the block, in newtons. */
  friction: number;
  /** The gravitational field strength, in N kg⁻¹. */
  gravity: number;
  labels: {
    along: ReactNode;
    deceleration: ReactNode;
    distance: ReactNode;
    viewLabel: string;
  };
  /** The block's mass, in kilograms. */
  mass: number;
  /** The block's speed up the plane when it is released, in m s⁻¹. */
  speed: number;
  title: ReactNode;
}

/**
 * A block released while moving up an inclined plane slides up and stops.
 * While it rises, both the part of its weight along the slope and the
 * friction point down the slope, so together they decelerate it.
 */
export function InclineSlideLab({
  angle,
  description,
  friction,
  gravity,
  labels,
  mass,
  speed,
  title,
}: InclineSlideLabProps) {
  const quantity = useQuantity();
  const slide = slideUp({ angle, friction, gravity, mass, speed });

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={inclineProgram}
          state={{
            along: slide.along,
            angle,
            deceleration: slide.deceleration,
            distance: slide.distance,
            friction,
            speed,
          }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.along}
            value={<InlineMath math={quantity(slide.along, "\\text{ N}", 1)} />}
          />
          <VisualFactTabular
            label={labels.deceleration}
            value={
              <InlineMath
                math={quantity(slide.deceleration, "\\text{ m s}^{-2}", 2)}
              />
            }
          />
          <VisualFactTabular
            label={labels.distance}
            value={
              <InlineMath math={quantity(slide.distance, "\\text{ m}", 2)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
