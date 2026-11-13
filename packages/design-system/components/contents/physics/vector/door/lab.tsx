import {
  arrow,
  createBackdrop,
  dashed,
  fade,
  gradientRect,
  mix,
  vignette,
  withShadow,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import {
  type Door,
  DoorSchema,
  doorTorque,
  swingAngle,
} from "@repo/design-system/components/contents/physics/vector/door/swing";
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
import { MATERIAL } from "@repo/design-system/lib/material";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useMemo, useState } from "react";

/** How long the door rests wide open before it closes and is pushed again, in seconds. */
const REST = 1.2;

/** The floorboards and the wall with its doorway, seen from the ceiling. */
function paintRoom(layer: p5, hinge: { x: number; y: number }, width: number) {
  gradientRect(
    layer,
    { height: layer.height, width: layer.width, x: 0, y: 0 },
    [
      [0, mix(MATERIAL.oak, getColor("WHITE"), 0.12)],
      [1, mix(MATERIAL.oak, getColor("BLACK"), 0.15)],
    ]
  );
  layer.noStroke();
  for (let board = 0; board < layer.height; board += 22) {
    layer.fill(fade(getColor("BLACK"), 0.08));
    layer.rect(0, board, layer.width, 1.5);
  }
  withShadow(
    layer,
    { blur: 14, color: fade(getColor("BLACK"), 0.5), drop: 6 },
    () => {
      layer.fill(mix(MATERIAL.concrete, getColor("WHITE"), 0.55));
      layer.rect(0, hinge.y - 14, hinge.x - 4, 28);
      layer.rect(hinge.x + width + 4, hinge.y - 14, layer.width, 28);
    }
  );
}

/**
 * Draws the door from above: the hinge, the slab turning open, the arm from
 * the hinge to the hand (slate), the push (amber), its part square to the
 * door (teal), and the torque's direction at the hinge (violet): the door
 * turns clockwise as seen from above, so the torque points down into the
 * floor, a cross in a circle.
 */
function doorProgram(
  sketch: p5,
  read: () => {
    readonly angle: number;
    readonly arm: number;
    readonly door: Door;
  }
) {
  const backdrop = createBackdrop();
  let time = 0;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const { angle, arm, door } = read();
    const push = doorTorque(door, arm, angle);
    const scale =
      Math.min(sketch.width * 0.62, sketch.height * 0.7) / door.width;
    const hinge = { x: sketch.width * 0.2, y: sketch.height * 0.3 };
    backdrop(sketch, `${door.width}`, (layer) =>
      paintRoom(layer, hinge, door.width * scale)
    );
    const duration = Math.sqrt((2 * (Math.PI / 2)) / Math.max(push.spin, 1e-6));
    if (sketch.isLooping()) {
      time += Math.min(sketch.deltaTime / 1000, 0.1);
      if (time > Math.min(duration, 8) + REST) {
        time = 0;
      }
    }
    const open = (swingAngle(push.spin, time) * Math.PI) / 180;
    const along = { x: Math.cos(open), y: Math.sin(open) };
    const square = { x: -along.y, y: along.x };
    const end = {
      x: hinge.x + along.x * door.width * scale,
      y: hinge.y + along.y * door.width * scale,
    };
    dashed(
      sketch,
      hinge,
      { x: hinge.x, y: hinge.y + door.width * scale },
      { color: fade(getColor("BLACK"), 0.25), dash: 6, weight: 1.5 }
    );
    withShadow(
      sketch,
      { blur: 10, color: fade(getColor("BLACK"), 0.45), drop: 5 },
      () => {
        sketch.stroke(MATERIAL.walnut);
        sketch.strokeWeight(14);
        sketch.strokeCap(sketch.SQUARE);
        sketch.line(hinge.x, hinge.y, end.x, end.y);
      }
    );
    sketch.noStroke();
    sketch.fill(MATERIAL.chrome);
    sketch.circle(hinge.x, hinge.y, 12);
    const hand = {
      x: hinge.x + along.x * arm * scale,
      y: hinge.y + along.y * arm * scale,
    };
    const turn = (angle * Math.PI) / 180;
    const forceLength = Math.min(sketch.width, sketch.height) * 0.3;
    const force = {
      x: (along.x * Math.cos(turn) + square.x * Math.sin(turn)) * forceLength,
      y: (along.y * Math.cos(turn) + square.y * Math.sin(turn)) * forceLength,
    };
    const head = Math.max(10, forceLength * 0.12);
    arrow(sketch, hinge, hand, { color: PLOT_COLORS.slate, head, weight: 3.5 });
    arrow(sketch, { x: hand.x - force.x, y: hand.y - force.y }, hand, {
      color: PLOT_COLORS.amber,
      head,
      weight: 4,
    });
    arrow(
      sketch,
      {
        x: hand.x - square.x * Math.sin(turn) * forceLength,
        y: hand.y - square.y * Math.sin(turn) * forceLength,
      },
      hand,
      { color: PLOT_COLORS.teal, head, weight: 3 }
    );
    sketch.noFill();
    sketch.stroke(PLOT_COLORS.violet);
    sketch.strokeWeight(3);
    sketch.circle(hinge.x - 34, hinge.y - 34, 22);
    if (push.torque > 1e-9) {
      sketch.line(hinge.x - 40, hinge.y - 40, hinge.x - 28, hinge.y - 28);
      sketch.line(hinge.x - 28, hinge.y - 40, hinge.x - 40, hinge.y - 28);
    }
    vignette(sketch, 0.3);
  };
}

interface DoorHingeTorqueLabProps {
  /** The angle between the door and the push the card starts at, in degrees. */
  angle: number;
  /** The distance of the hand from the hinge the card starts at, in metres. */
  arm: number;
  description: ReactNode;
  /** The push, in newtons. */
  force: number;
  labels: {
    angle: ReactNode;
    angleName: string;
    arm: ReactNode;
    armName: string;
    square: ReactNode;
    torque: ReactNode;
    viewLabel: string;
  };
  /** The mass of the door, in kilograms. */
  mass: number;
  title: ReactNode;
  /** The width of the door, in metres. */
  width: number;
}

/**
 * A door seen from the ceiling, pushed open by a hand. The learner moves
 * the hand along the door and turns the push: the torque is the cross
 * product r × F, r F sin θ, so a push far from the hinge and square to the
 * door swings it open fastest, and a push along the door does nothing.
 */
export function DoorHingeTorqueLab({
  angle: startAngle,
  arm: startArm,
  description,
  force,
  labels,
  mass,
  title,
  width,
}: DoorHingeTorqueLabProps) {
  const quantity = useQuantity();
  const [angle, setAngle] = useState(startAngle);
  const [arm, setArm] = useState(startArm);
  const door = useMemo(
    () => Schema.decodeUnknownSync(DoorSchema)({ force, mass, width }),
    [force, mass, width]
  );
  const push = doorTorque(door, arm, angle);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <div className="grid w-full gap-4 sm:grid-cols-2">
          <LabSlider
            label={labels.arm}
            max={width}
            min={0.1}
            name={labels.armName}
            onValueChange={setArm}
            readout={<InlineMath math={quantity(arm, "\\text{ m}", 2)} />}
            step={0.05}
            value={arm}
          />
          <LabSlider
            label={labels.angle}
            max={180}
            min={0}
            name={labels.angleName}
            onValueChange={setAngle}
            readout={<InlineMath math={quantity(angle, "^\\circ", 0)} />}
            step={1}
            value={angle}
          />
        </div>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={doorProgram}
          state={{ angle, arm, door }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.square}
            value={<InlineMath math={quantity(push.square, "\\text{ N}", 1)} />}
          />
          <VisualFactTabular
            label={labels.torque}
            value={
              <InlineMath
                math={quantity(push.torque, "\\text{ N}\\cdot\\text{m}", 2)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
