import {
  advanceRun,
  shownTime,
} from "@repo/design-system/components/contents/physics/canvas/clock";
import {
  fade,
  gradientRect,
  mix,
  vignette,
  withShadow,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import {
  CRATE_WEIGHT,
  crateHeight,
  LIFT_ENERGY,
  LIFT_HEIGHT,
  liftSpeed,
  liftTime,
  MOTOR_POWER,
  type Motor,
  MotorSchema,
} from "@repo/design-system/components/contents/physics/renewable-energy/hoist/lift";
import {
  paintClouds,
  paintGround,
  paintHills,
  paintSky,
} from "@repo/design-system/components/contents/physics/renewable-energy/scenery/outdoor";
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
import { Array as Arr, Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** How long the crate rests on the platform before the run starts again, in seconds. */
const HOLD_SECONDS = 1.4;

/** What the sketch reads on every frame: the motor the hoist runs on. */
const HoistFrameSchema = Schema.Struct({ motor: MotorSchema });
type HoistFrame = typeof HoistFrameSchema.Type;

/** Positions of the site for one canvas size: the ground, the tower, and the scale of a metre. */
function layout(sketch: p5) {
  const { height, width } = sketch;
  const ground = height * 0.86;
  const top = height * 0.16;
  return {
    ground,
    metre: (ground - top) / (LIFT_HEIGHT + 0.6),
    towerLeft: width * 0.36,
    towerWidth: Math.max(width * 0.07, 34),
  };
}

/** The scaffold tower, the platform at 5 m, and a ruler marked every metre. */
function paintTower(sketch: p5, place: ReturnType<typeof layout>) {
  const platform = place.ground - LIFT_HEIGHT * place.metre;
  const right = place.towerLeft + place.towerWidth;
  const topOfTower = platform - place.metre * 0.55;
  sketch.stroke(mix(MATERIAL.galvanizedSteel, getColor("SLATE", 700), 0.3));
  sketch.strokeWeight(Math.max(2, place.towerWidth * 0.08));
  sketch.line(place.towerLeft, place.ground, place.towerLeft, topOfTower);
  sketch.line(right, place.ground, right, topOfTower);
  sketch.strokeWeight(1.2);
  for (let metre = 0; metre < LIFT_HEIGHT + 0.5; metre += 1) {
    const y = place.ground - metre * place.metre;
    const next = y - place.metre;
    sketch.line(place.towerLeft, y, right, Math.max(next, topOfTower));
    sketch.line(place.towerLeft, y, right, y);
  }
  sketch.noStroke();
  withShadow(
    sketch,
    { blur: 12, color: fade(getColor("BLACK"), 0.5), drop: 6 },
    () => {
      gradientRect(
        sketch,
        {
          height: place.metre * 0.12,
          width: sketch.width * 0.3,
          x: right,
          y: platform,
        },
        [
          [0, mix(MATERIAL.concrete, getColor("WHITE"), 0.3)],
          [1, mix(MATERIAL.concrete, getColor("BLACK"), 0.25)],
        ]
      );
    }
  );
  const rulerX = place.towerLeft - sketch.width * 0.06;
  sketch.stroke(fade(getColor("WHITE"), 0.75));
  sketch.strokeWeight(1.5);
  sketch.line(rulerX, place.ground, rulerX, platform);
  for (let metre = 0; metre <= LIFT_HEIGHT; metre += 1) {
    const y = place.ground - metre * place.metre;
    sketch.line(rulerX - 7, y, rulerX + 7, y);
  }
  sketch.noStroke();
  return { platform, topOfTower };
}

/** The winch on the tower's top, its drum turning while it winds the rope. */
function paintWinch(
  sketch: p5,
  place: ReturnType<typeof layout>,
  top: number,
  turn: number
) {
  const drum = place.towerWidth * 0.42;
  const x = place.towerLeft + place.towerWidth * 0.5;
  const y = top - drum * 0.4;
  withShadow(
    sketch,
    { blur: 10, color: fade(getColor("BLACK"), 0.5), drop: 4 },
    () => {
      gradientRect(
        sketch,
        {
          height: drum * 1.4,
          width: place.towerWidth * 1.5,
          x: x - place.towerWidth * 1.35,
          y: y - drum * 0.7,
        },
        [
          [0, mix(MATERIAL.buoyPaint, getColor("WHITE"), 0.25)],
          [1, mix(MATERIAL.buoyPaint, getColor("BLACK"), 0.35)],
        ]
      );
    }
  );
  sketch.fill(getColor("ZINC", 900));
  sketch.circle(x, y, drum * 1.6);
  sketch.stroke(getColor("SLATE", 300));
  sketch.strokeWeight(2);
  for (let spoke = 0; spoke < 3; spoke += 1) {
    const angle = turn + (spoke * Math.PI * 2) / 3;
    sketch.line(
      x,
      y,
      x + Math.cos(angle) * drum * 0.7,
      y + Math.sin(angle) * drum * 0.7
    );
  }
  sketch.noStroke();
  return { x: x + drum * 0.8, y };
}

/** The crate on its rope, lit from above, with its shadow on the ground. */
function paintCrate(
  sketch: p5,
  place: ReturnType<typeof layout>,
  rope: { x: number; y: number },
  height: number
) {
  const size = place.metre * 0.75;
  const bottom = place.ground - height * place.metre;
  const left = rope.x - size / 2;
  const shadow = 1 - Math.min(height / LIFT_HEIGHT, 1) * 0.7;
  sketch.fill(fade(getColor("BLACK"), 0.4 * shadow));
  sketch.ellipse(
    rope.x,
    place.ground + 2,
    size * (1.4 - shadow * 0.3),
    size * 0.18
  );
  sketch.stroke(getColor("ZINC", 900));
  sketch.strokeWeight(2);
  sketch.line(rope.x, rope.y, rope.x, bottom - size);
  sketch.noStroke();
  withShadow(
    sketch,
    { blur: 14, color: fade(getColor("BLACK"), 0.55), drop: 6 },
    () => {
      gradientRect(
        sketch,
        { height: size, width: size, x: left, y: bottom - size },
        [
          [0, mix(MATERIAL.crateWood, getColor("WHITE"), 0.3)],
          [0.4, MATERIAL.crateWood],
          [1, mix(MATERIAL.crateWood, getColor("BLACK"), 0.45)],
        ]
      );
    }
  );
  sketch.stroke(fade(MATERIAL.bark, 0.8));
  sketch.strokeWeight(1.5);
  sketch.line(left, bottom - size, left + size, bottom);
  sketch.line(left + size, bottom - size, left, bottom);
  sketch.noStroke();
}

/**
 * Draws one moment of the lift: the winch winds the rope at the speed its
 * power allows, the crate rises past the metre marks, and it rests on the
 * platform before the run starts again.
 */
function hoistProgram(sketch: p5, read: () => HoistFrame) {
  let time = 0;
  let clouds = 0;
  let shown: Motor | undefined;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
    sketch.noStroke();
  };
  sketch.draw = () => {
    const { motor } = read();
    const duration = liftTime(motor);
    if (shown !== motor) {
      shown = motor;
      time = sketch.isLooping() ? 0 : duration;
    }
    if (sketch.isLooping()) {
      const elapsed = sketch.deltaTime / 1000;
      time = advanceRun(time, elapsed, {
        duration,
        hold: HOLD_SECONDS,
        rate: 1,
      });
      clouds += Math.min(elapsed, 0.1);
    }
    const now = shownTime(time, duration);
    const place = layout(sketch);
    paintSky(sketch, place.ground);
    paintClouds(sketch, place.ground, clouds);
    paintHills(sketch, place.ground);
    paintGround(sketch, place.ground, MATERIAL.soil);
    const { topOfTower } = paintTower(sketch, place);
    const height = crateHeight(motor, now);
    const turn = (height * place.metre) / (place.towerWidth * 0.35);
    const rope = paintWinch(sketch, place, topOfTower, turn);
    paintCrate(sketch, place, rope, height);
    vignette(sketch, 0.3);
  };
}

interface HoistWorkLabProps {
  description: ReactNode;
  labels: {
    chooseMotor: string;
    energy: ReactNode;
    height: ReactNode;
    speed: ReactNode;
    time: ReactNode;
    viewLabel: string;
    weight: ReactNode;
  };
  /** The motor the hoist runs on first. */
  motor?: Motor;
  title: ReactNode;
}

/**
 * A motor hoist lifts a 20 kg crate 5 m onto a platform. The crate always
 * gains its 200 N weight times 5 m, 1000 J, so a stronger motor only does the
 * same work sooner: energy is force times distance, power is energy per second.
 */
export function HoistWorkLab({
  description,
  labels,
  motor: initialMotor = "medium",
  title,
}: HoistWorkLabProps) {
  const [motor, setMotor] = useState<Motor>(initialMotor);
  const measure = useQuantity();
  const isMotor = Schema.is(MotorSchema);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseMotor}
          gridColumns="3"
          onValueChange={(value) => {
            if (isMotor(value)) {
              setMotor(value);
            }
          }}
          type="single"
          value={motor}
          variant="outline"
        >
          {Arr.map(MotorSchema.literals, (option) => (
            <ToggleGroupItem key={option} value={option}>
              <InlineMath
                math={measure(MOTOR_POWER[option], "\\text{ W}", 0)}
              />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={hoistProgram}
          state={{ motor }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.weight}
            value={<InlineMath math={measure(CRATE_WEIGHT, "\\text{ N}", 0)} />}
          />
          <VisualFactTabular
            label={labels.height}
            value={<InlineMath math={measure(LIFT_HEIGHT, "\\text{ m}", 0)} />}
          />
          <VisualFactTabular
            label={labels.energy}
            value={<InlineMath math={measure(LIFT_ENERGY, "\\text{ J}", 0)} />}
          />
          <VisualFactTabular
            label={labels.time}
            value={
              <InlineMath math={measure(liftTime(motor), "\\text{ s}", 0)} />
            }
          />
          <VisualFactTabular
            label={labels.speed}
            value={
              <InlineMath math={measure(liftSpeed(motor), "\\text{ m/s}", 2)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
