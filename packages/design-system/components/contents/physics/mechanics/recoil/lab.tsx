import {
  fade,
  gradientRect,
  mix,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { recoil } from "@repo/design-system/components/contents/physics/mechanics/force";
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

/** Wall seconds one shot plays over, then holds. */
const SHOT_SECONDS = 2.4;

/** What the sketch reads on every frame: the stopping distance in centimetres. */
const RecoilFrameSchema = Schema.Struct({ stop: Schema.Finite });
type RecoilFrame = typeof RecoilFrameSchema.Type;

/**
 * Draws one moment of the shot: the rifle against the shoulder, the bullet
 * leaving to the right and the rifle kicking back to the left with momentum
 * arrows of the same length, then the shoulder's force pushing the rifle to
 * rest over the stopping distance.
 */
function recoilProgram(sketch: p5, read: () => RecoilFrame) {
  // The first frame shows the moment just after firing, so a paused card shows both momenta.
  let clock = 0.35;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const frame = read();
    if (sketch.isLooping()) {
      clock = (clock + Math.min(sketch.deltaTime / 1000, 0.1)) % SHOT_SECONDS;
    }
    const { height, width } = sketch;
    const floor = height * 0.86;
    paintRoom(sketch, floor);
    // The rifle is drawn half the frame long for a real rifle of about 110 cm, so its kick keeps that scale.
    const centimetre = (width * 0.5) / 110;
    const kick = Math.min(clock / 0.5, 1);
    const back = frame.stop * centimetre * (1 - (1 - kick) ** 2);
    const barrel = { x: width * 0.3 - back, y: height * 0.42 };
    gradientRect(
      sketch,
      {
        height: height * 0.07,
        width: width * 0.18,
        x: barrel.x - width * 0.18,
        y: barrel.y - height * 0.02,
      },
      [
        [0, mix(MATERIAL.walnut, getColor("WHITE"), 0.15)],
        [1, mix(MATERIAL.walnut, getColor("BLACK"), 0.35)],
      ]
    );
    gradientRect(
      sketch,
      {
        height: height * 0.025,
        width: width * 0.32,
        x: barrel.x,
        y: barrel.y - height * 0.005,
      },
      [
        [0, mix(MATERIAL.castIron, getColor("WHITE"), 0.2)],
        [1, mix(MATERIAL.castIron, getColor("BLACK"), 0.4)],
      ]
    );
    sketch.noStroke();
    sketch.fill(fade(MATERIAL.cotton, 0.85));
    sketch.ellipse(
      width * 0.08,
      barrel.y + height * 0.02,
      width * 0.12,
      height * 0.18
    );
    if (clock < 1.2) {
      const flight = (clock / 1.2) * width * 0.4;
      sketch.fill(MATERIAL.brass);
      sketch.rect(barrel.x + width * 0.32 + flight, barrel.y, 12, 5, 2);
    }
    if (clock < 0.9) {
      const arm = width * 0.16;
      force(
        sketch,
        { x: width * 0.66, y: height * 0.24 },
        { x: width * 0.66 + arm, y: height * 0.24 },
        PLOT_COLORS.pink,
        "p"
      );
      force(
        sketch,
        { x: width * 0.3, y: height * 0.24 },
        { x: width * 0.3 - arm, y: height * 0.24 },
        PLOT_COLORS.teal,
        "p"
      );
    } else if (clock < 1.6) {
      force(
        sketch,
        { x: width * 0.06, y: height * 0.62 },
        { x: width * 0.22, y: height * 0.62 },
        PLOT_COLORS.orange,
        "F"
      );
    }
    sketch.stroke(PLOT_COLORS.amber);
    sketch.strokeWeight(2);
    sketch.line(
      width * 0.12,
      height * 0.72,
      width * 0.12 + frame.stop * centimetre,
      height * 0.72
    );
    vignette(sketch, 0.3);
  };
}

interface RecoilLabProps {
  /** The mass of the bullet, in grams. */
  bulletMass: number;
  description: NonNullable<ReactNode>;
  labels: {
    energy: ReactNode;
    force: ReactNode;
    momentum: ReactNode;
    velocity: ReactNode;
    viewLabel: string;
  };
  /** The mass of the rifle, in kilograms. */
  rifleMass: number;
  /** The bullet's speed, in m s⁻¹. */
  speed: number;
  /** The distance over which the shoulder stops the rifle, in centimetres. */
  stop: number;
  title: NonNullable<ReactNode>;
}

/**
 * A rifle fires a bullet. Both were at rest, so their momenta after the shot
 * are equal and opposite: the heavy rifle kicks back slowly. The shoulder
 * then does work on the rifle equal to its kinetic energy as it stops it over
 * a short distance, which sets the average force.
 */
export function RecoilLab({
  bulletMass,
  description,
  labels,
  rifleMass,
  speed,
  stop,
  title,
}: RecoilLabProps) {
  const quantity = useQuantity();
  const shot = recoil({
    bullet: bulletMass / 1000,
    rifle: rifleMass,
    speed,
    stop: stop / 100,
  });

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={recoilProgram}
          state={{ stop }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.momentum}
            value={
              <InlineMath
                math={quantity(shot.momentum, "\\text{ kg m s}^{-1}", 2)}
              />
            }
          />
          <VisualFactTabular
            label={labels.velocity}
            value={
              <InlineMath
                math={quantity(shot.velocity, "\\text{ m s}^{-1}", 2)}
              />
            }
          />
          <VisualFactTabular
            label={labels.energy}
            value={<InlineMath math={quantity(shot.energy, "\\text{ J}", 2)} />}
          />
          <VisualFactTabular
            label={labels.force}
            value={<InlineMath math={quantity(shot.force, "\\text{ N}", 0)} />}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
