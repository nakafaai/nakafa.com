import {
  createBackdrop,
  dashed,
  fade,
  gradientRect,
  mix,
  outOfFocus,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import {
  JET_GRAVITY,
  type JetAngle,
  JetAngleSchema,
  jetDrop,
  jetShape,
} from "@repo/design-system/components/contents/physics/kinematics/fountain/jet";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
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

/** How many drops are in the air at once along the stream. */
const DROPS = 90;

/** Simulated seconds per wall second, so single drops can be followed. */
const PLAY_RATE = 0.5;

/** What the sketch reads on every frame. */
interface FountainFrame {
  readonly angle: JetAngle;
  readonly speed: number;
}

/** Maps metres onto the canvas: the nozzle near the left, the farthest landing and the highest top in view. */
function lawnView(sketch: p5, speed: number) {
  const farthest = (speed * speed) / JET_GRAVITY;
  const highest = (speed * speed) / (2 * JET_GRAVITY);
  const scale = Math.min(
    (sketch.width * 0.8) / farthest,
    (sketch.height * 0.72) / highest
  );
  const ground = sketch.height * 0.86;
  const nozzle = sketch.width * 0.1;
  return {
    ground,
    nozzle,
    scale,
    x: (metres: number) => nozzle + metres * scale,
    y: (metres: number) => ground - metres * scale,
  };
}

/** The garden: sky, a hedge out of focus, the lawn with a metre mark every metre. */
function paintGarden(sketch: p5, view: ReturnType<typeof lawnView>) {
  gradientRect(
    sketch,
    { height: view.ground, width: sketch.width, x: 0, y: 0 },
    [
      [0, MATERIAL.skyZenith],
      [1, MATERIAL.skyHaze],
    ]
  );
  outOfFocus(sketch, 4, () => {
    sketch.noStroke();
    for (let index = 0; index < 24; index += 1) {
      const x = (index / 23) * sketch.width;
      const r = sketch.height * (0.06 + 0.05 * hashUnit(index, 3));
      sketch.fill(
        mix(
          MATERIAL.foliageDark,
          MATERIAL.skyHaze,
          0.25 + 0.2 * hashUnit(index, 5)
        )
      );
      sketch.circle(x, view.ground - r * 0.6, r * 2.2);
    }
  });
  gradientRect(
    sketch,
    {
      height: sketch.height - view.ground,
      width: sketch.width,
      x: 0,
      y: view.ground,
    },
    [
      [0, MATERIAL.grass],
      [1, mix(MATERIAL.grass, MATERIAL.foliageDark, 0.6)],
    ]
  );
  sketch.fill(fade(MATERIAL.roadPaint, 0.75));
  sketch.noStroke();
  for (let metre = 1; view.x(metre) < sketch.width; metre += 1) {
    sketch.rect(view.x(metre) - 1, view.ground, 2, sketch.height * 0.025);
  }
}

/** The nozzle at the end of the hose, pointing along the jet. */
function paintNozzle(
  sketch: p5,
  view: ReturnType<typeof lawnView>,
  angle: number
) {
  sketch.push();
  sketch.stroke(mix(PLOT_COLORS.teal, getColor("BLACK"), 0.35));
  sketch.strokeWeight(sketch.height * 0.02);
  sketch.noFill();
  sketch.bezier(
    0,
    view.ground + 4,
    view.nozzle * 0.4,
    view.ground + 6,
    view.nozzle * 0.6,
    view.ground,
    view.nozzle,
    view.ground
  );
  sketch.translate(view.nozzle, view.ground);
  sketch.rotate((-angle * Math.PI) / 180);
  sketch.noStroke();
  sketch.fill(MATERIAL.batteryTerminal);
  sketch.rect(
    0,
    -sketch.height * 0.012,
    sketch.height * 0.05,
    sketch.height * 0.024,
    3
  );
  sketch.pop();
}

/**
 * Draws the stream: drops leave the nozzle one after another and each
 * follows the same parabola, so the stream holds still while every drop in
 * it moves; a faint dashed line marks the stream at 45 degrees, the
 * farthest one.
 */
function fountainProgram(sketch: p5, read: () => FountainFrame) {
  let clock = 0;
  const backdrop = createBackdrop();
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const { angle, speed } = read();
    if (sketch.isLooping()) {
      clock += Math.min(sketch.deltaTime / 1000, 0.1) * PLAY_RATE;
    }
    const view = lawnView(sketch, speed);
    backdrop(sketch, `${speed}`, (layer) => paintGarden(layer, view));
    const farthest = jetShape(speed, 45);
    for (let step = 0; step < 40; step += 1) {
      const from = jetDrop(speed, 45, (farthest.flight * step) / 40);
      const to = jetDrop(speed, 45, (farthest.flight * (step + 1)) / 40);
      if (step % 2 === 0) {
        dashed(
          sketch,
          { x: view.x(from.x), y: view.y(from.y) },
          { x: view.x(to.x), y: view.y(to.y) },
          { color: fade(getColor("WHITE"), 0.45), dash: 4, weight: 1.5 }
        );
      }
    }
    const { flight, range } = jetShape(speed, angle);
    sketch.noStroke();
    for (let index = 0; index < DROPS; index += 1) {
      const age = ((index / DROPS) * flight + clock) % flight;
      const drop = jetDrop(speed, angle, age);
      const spread = (hashUnit(index, 7) - 0.5) * 0.06 * age;
      sketch.fill(fade(MATERIAL.waterGlint, 0.85));
      sketch.circle(
        view.x(drop.x + spread),
        view.y(drop.y + spread),
        Math.max(3, view.scale * 0.035)
      );
      sketch.fill(fade(MATERIAL.water, 0.5));
      sketch.circle(
        view.x(drop.x + spread) + 1,
        view.y(drop.y + spread) + 1,
        Math.max(2, view.scale * 0.02)
      );
    }
    sketch.fill(fade(MATERIAL.waterGlint, 0.4));
    sketch.ellipse(
      view.x(range),
      view.ground + 2,
      view.scale * 0.5,
      view.scale * 0.08
    );
    paintNozzle(sketch, view, angle);
    vignette(sketch, 0.28);
  };
}

interface HoseJetProjectileLabProps {
  description: ReactNode;
  labels: {
    chooseAngle: string;
    flight: ReactNode;
    range: ReactNode;
    top: ReactNode;
    viewLabel: string;
  };
  /** The speed the water leaves the nozzle at, in m/s. */
  speed: number;
  title: ReactNode;
}

/**
 * A garden hose held at the ground and tilted to six angles. Every drop
 * follows the same parabola, so the stream is the path itself. The range
 * is greatest at 45 degrees, angles that add up to 90 degrees land at the
 * same spot, and the vertical jet climbs highest but lands at the nozzle.
 */
export function HoseJetProjectileLab({
  description,
  labels,
  speed,
  title,
}: HoseJetProjectileLabProps) {
  const [angle, setAngle] = useState<JetAngle>(45);
  const quantity = useQuantity();
  const shape = jetShape(speed, angle);
  const isAngle = Schema.is(JetAngleSchema);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseAngle}
          gridColumns="6"
          onValueChange={(value) => {
            const next = Number(value);
            if (isAngle(next)) {
              setAngle(next);
            }
          }}
          type="single"
          value={String(angle)}
          variant="outline"
        >
          {Arr.map(JetAngleSchema.literals, (option) => (
            <ToggleGroupItem key={option} value={String(option)}>
              <InlineMath math={`${option}^\\circ`} />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={fountainProgram}
          state={{ angle, speed }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.range}
            value={<InlineMath math={quantity(shape.range, "\\text{ m}", 2)} />}
          />
          <VisualFactTabular
            label={labels.top}
            value={<InlineMath math={quantity(shape.top, "\\text{ m}", 2)} />}
          />
          <VisualFactTabular
            label={labels.flight}
            value={
              <InlineMath math={quantity(shape.flight, "\\text{ s}", 2)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
