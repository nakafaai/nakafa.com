import { caption } from "@repo/design-system/components/contents/physics/canvas/caption";
import {
  fade,
  gradientRect,
  mix,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { liftAcceleration } from "@repo/design-system/components/contents/physics/mechanics/force";
import { force } from "@repo/design-system/components/contents/physics/mechanics/stage";
import {
  useQuantity,
  useReading,
} from "@repo/design-system/components/contents/simulation/quantity";
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

/** The four ways a lift can move with an acceleration of the given size. */
const CaseSchema = Schema.Literals([
  "upFaster",
  "upSlower",
  "downFaster",
  "downSlower",
]);
type Case = typeof CaseSchema.Type;

/** Whether the lift moves up in a case, and whether its acceleration points up. */
const MotionSchema = Schema.Struct({
  accelerationUp: Schema.Boolean,
  movingUp: Schema.Boolean,
});

/** Each case's direction of motion and direction of acceleration. */
const CASES = {
  downFaster: { accelerationUp: false, movingUp: false },
  downSlower: { accelerationUp: true, movingUp: false },
  upFaster: { accelerationUp: true, movingUp: true },
  upSlower: { accelerationUp: false, movingUp: true },
} as const satisfies Record<Case, typeof MotionSchema.Type>;

/** What the sketch reads on every frame. */
const LiftFrameSchema = Schema.Struct({
  movingUp: Schema.Boolean,
  normal: Schema.Finite,
  reading: Schema.String,
  weight: Schema.Finite,
});
type LiftFrame = typeof LiftFrameSchema.Type;

/**
 * Draws one moment: the lift cabin moving in its shaft, the student standing
 * on the scales with the normal force up and the weight down drawn to scale,
 * and the scales' display showing the normal force.
 */
function liftProgram(sketch: p5, read: () => LiftFrame) {
  let clock = 0;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const frame = read();
    if (sketch.isLooping()) {
      clock += Math.min(sketch.deltaTime / 1000, 0.1);
    }
    const { height, width } = sketch;
    gradientRect(sketch, { height, width, x: 0, y: 0 }, [
      [0, mix(MATERIAL.concrete, getColor("BLACK"), 0.55)],
      [1, mix(MATERIAL.concrete, getColor("BLACK"), 0.7)],
    ]);
    const drift = ((clock * 40) % 60) * (frame.movingUp ? 1 : -1);
    sketch.stroke(fade(getColor("WHITE"), 0.15));
    sketch.strokeWeight(2);
    for (let y = -60 + drift; y < height + 60; y += 60) {
      sketch.line(width * 0.2, y, width * 0.24, y);
      sketch.line(width * 0.76, y, width * 0.8, y);
    }
    const cabin = {
      height: height * 0.8,
      width: width * 0.5,
      x: width * 0.25,
      y: height * 0.1,
    };
    gradientRect(
      sketch,
      cabin,
      [
        [0, mix(MATERIAL.galvanizedSteel, getColor("WHITE"), 0.15)],
        [1, mix(MATERIAL.galvanizedSteel, getColor("BLACK"), 0.35)],
      ],
      true
    );
    const floor = cabin.y + cabin.height * 0.92;
    const centre = cabin.x + cabin.width / 2;
    sketch.noStroke();
    sketch.fill(MATERIAL.balanceBody);
    sketch.rect(
      centre - cabin.width * 0.18,
      floor - 10,
      cabin.width * 0.36,
      10,
      3
    );
    sketch.fill(MATERIAL.lcd);
    sketch.rect(
      centre - cabin.width * 0.12,
      floor - 8,
      cabin.width * 0.24,
      6,
      2
    );
    sketch.fill(MATERIAL.trolleyPaint);
    sketch.rect(
      centre - cabin.width * 0.08,
      floor - cabin.height * 0.5,
      cabin.width * 0.16,
      cabin.height * 0.3,
      8
    );
    sketch.fill(MATERIAL.cellBody);
    sketch.circle(centre, floor - cabin.height * 0.56, cabin.width * 0.14);
    sketch.fill(MATERIAL.tintedGlass);
    sketch.rect(
      centre - cabin.width * 0.06,
      floor - cabin.height * 0.2,
      cabin.width * 0.05,
      cabin.height * 0.19,
      3
    );
    sketch.rect(
      centre + cabin.width * 0.01,
      floor - cabin.height * 0.2,
      cabin.width * 0.05,
      cabin.height * 0.19,
      3
    );
    const newton = (cabin.height * 0.36) / Math.max(frame.normal, frame.weight);
    const middle = floor - cabin.height * 0.36;
    force(
      sketch,
      { x: centre + cabin.width * 0.22, y: middle },
      { x: centre + cabin.width * 0.22, y: middle - frame.normal * newton },
      PLOT_COLORS.teal,
      "R"
    );
    force(
      sketch,
      { x: centre - cabin.width * 0.22, y: middle },
      { x: centre - cabin.width * 0.22, y: middle + frame.weight * newton },
      PLOT_COLORS.pink,
      "W"
    );
    caption(
      sketch,
      frame.reading,
      { x: centre, y: floor + 16 },
      { align: "center", baseline: "top", color: MATERIAL.lcdInk, size: 13 }
    );
    vignette(sketch, 0.3);
  };
}

interface LiftScaleLabProps {
  description: ReactNode;
  /** The gravitational field strength, in N kg⁻¹. */
  gravity: number;
  labels: {
    acceleration: ReactNode;
    cases: Record<Case, ReactNode>;
    motion: string;
    reading: ReactNode;
    viewLabel: string;
  };
  /** The student's mass, in kilograms. */
  mass: number;
  /** The scale reading the item gives, in newtons. */
  reading: number;
  title: ReactNode;
}

/**
 * A student stands on scales in a lift. The scales read the normal force, so
 * a reading above the weight means an upward acceleration, whichever way the
 * lift moves. Step through the four ways a lift can move with an acceleration
 * of that size and see which two give the reading in the question.
 */
export function LiftScaleLab({
  description,
  gravity,
  labels,
  mass,
  reading: given,
  title,
}: LiftScaleLabProps) {
  const quantity = useQuantity();
  const readingText = useReading();
  const size = Math.abs(liftAcceleration(mass, given, gravity));
  const [motion, setMotion] = useState<Case>("downSlower");
  const isCase = Schema.is(CaseSchema);
  const chosen = CASES[motion];
  const acceleration = chosen.accelerationUp ? size : -size;
  const normal = mass * (gravity + acceleration);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.motion}
          gridColumns="4"
          onValueChange={(value) => {
            if (isCase(value)) {
              setMotion(value);
            }
          }}
          type="single"
          value={motion}
          variant="outline"
        >
          {Arr.map(CaseSchema.literals, (option) => (
            <ToggleGroupItem key={option} value={option}>
              {labels.cases[option]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={liftProgram}
          state={{
            movingUp: chosen.movingUp,
            normal,
            reading: `${readingText(normal, 0)} N`,
            weight: mass * gravity,
          }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.acceleration}
            value={
              <InlineMath
                math={quantity(acceleration, "\\text{ m s}^{-2}", 2)}
              />
            }
          />
          <VisualFactTabular
            label={labels.reading}
            value={<InlineMath math={quantity(normal, "\\text{ N}", 0)} />}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
