import { caption } from "@repo/design-system/components/contents/physics/canvas/caption";
import {
  arrow,
  fade,
  mix,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import { balancingCurrent } from "@repo/design-system/components/contents/physics/field/magnet";
import { paintBench } from "@repo/design-system/components/contents/physics/heat/glass";
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
import { type ReactNode, useState } from "react";

/** What the sketch reads on every frame: the magnetic force over the weight, and the current's sign along the wire. */
const BalanceFrameSchema = Schema.Struct({
  share: Schema.Finite,
});
type BalanceFrame = typeof BalanceFrameSchema.Type;

/**
 * Places a point given in metres east, north and up on the canvas in an
 * isometric view, east to the lower right and north to the upper right.
 */
function iso(sketch: p5, east: number, north: number, up: number) {
  const unit = Math.min(sketch.width, sketch.height) * 0.36;
  const angle = Math.PI / 6;
  return {
    x: sketch.width * 0.46 + (east + north) * Math.cos(angle) * unit,
    y:
      sketch.height * 0.6 + (east - north) * Math.sin(angle) * unit - up * unit,
  };
}

/**
 * Draws one moment, in an isometric view: the two poles of a magnet with its
 * field pointing north between them, the wire lying east to west across the
 * gap carrying the current east, and the magnetic force up against the
 * weight down, each arrow as long as its force. The wire lifts while the
 * force beats the weight and sags while it does not.
 */
function balanceProgram(sketch: p5, read: () => BalanceFrame) {
  let lift = 0;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const frame = read();
    const target = Math.max(-0.12, Math.min(0.12, (frame.share - 1) * 0.25));
    lift +=
      (target - lift) * Math.min(Math.min(sketch.deltaTime / 1000, 0.1) * 3, 1);
    const { height } = sketch;
    paintBench(sketch, height * 0.72);
    const block = (north: number, color: string) => {
      const corners = [
        iso(sketch, -0.25, north - 0.12, 0),
        iso(sketch, 0.25, north - 0.12, 0),
        iso(sketch, 0.25, north - 0.12, 0.5),
        iso(sketch, -0.25, north - 0.12, 0.5),
      ];
      sketch.noStroke();
      sketch.fill(color);
      sketch.beginShape();
      for (const corner of corners) {
        sketch.vertex(corner.x, corner.y);
      }
      sketch.endShape(sketch.CLOSE);
    };
    block(0.67, mix(MATERIAL.trolleyPaint, getColor("BLACK"), 0.1));
    const wireHeight = 0.25 + lift;
    const from = iso(sketch, -0.6, 0, wireHeight);
    const to = iso(sketch, 0.6, 0, wireHeight);
    sketch.stroke(mix(MATERIAL.copper, getColor("BLACK"), 0.3));
    sketch.strokeWeight(6);
    sketch.line(from.x, from.y, to.x, to.y);
    sketch.stroke(mix(MATERIAL.copper, getColor("WHITE"), 0.35));
    sketch.strokeWeight(2);
    sketch.line(from.x, from.y - 1.5, to.x, to.y - 1.5);
    const centre = iso(sketch, 0, 0, wireHeight);
    arrow(sketch, iso(sketch, 0, -0.35, 0.12), iso(sketch, 0, 0.35, 0.12), {
      color: PLOT_COLORS.violet,
      head: 11,
      weight: 3,
    });
    arrow(
      sketch,
      iso(sketch, 0.25, 0, wireHeight),
      iso(sketch, 0.55, 0, wireHeight),
      { color: PLOT_COLORS.amber, head: 11, weight: 3 }
    );
    const force = 0.32 * frame.share;
    arrow(sketch, centre, iso(sketch, 0, 0, wireHeight + force), {
      color: PLOT_COLORS.teal,
      head: 11,
      weight: 3.5,
    });
    arrow(sketch, centre, iso(sketch, 0, 0, wireHeight - 0.32), {
      color: PLOT_COLORS.pink,
      head: 11,
      weight: 3.5,
    });
    block(-0.55, mix(MATERIAL.signalRed, getColor("BLACK"), 0.15));
    const pole = {
      align: "center",
      baseline: "middle",
      color: getColor("WHITE"),
      size: 15,
    } as const;
    // The field runs from the north pole to the south pole, so the north pole stands on the south side.
    caption(sketch, "N", iso(sketch, 0, -0.67, 0.25), pole);
    caption(sketch, "S", iso(sketch, 0, 0.55, 0.25), pole);
    const axis = {
      align: "left",
      baseline: "middle",
      color: fade(getColor("WHITE"), 0.85),
      size: 12,
    } as const;
    caption(sketch, "B", iso(sketch, 0, 0.4, 0.12), {
      ...axis,
      color: PLOT_COLORS.violet,
    });
    caption(sketch, "I", iso(sketch, 0.6, 0, wireHeight), {
      ...axis,
      color: PLOT_COLORS.amber,
    });
    caption(sketch, "F", iso(sketch, 0.04, 0, wireHeight + force), {
      ...axis,
      color: PLOT_COLORS.teal,
    });
    caption(sketch, "W", iso(sketch, 0.04, 0, wireHeight - 0.32), {
      ...axis,
      color: PLOT_COLORS.pink,
    });
    vignette(sketch, 0.3);
  };
}

interface CurrentBalanceLabProps {
  description: ReactNode;
  /** The magnetic flux density, in teslas. */
  field: number;
  labels: {
    current: ReactNode;
    currentName: string;
    force: ReactNode;
    needed: ReactNode;
    viewLabel: string;
    weight: ReactNode;
  };
  /** The length of wire inside the field, in centimetres. */
  length: number;
  /** The mass of the wire, in grams. */
  mass: number;
  title: ReactNode;
}

/**
 * A straight wire lies east to west across the gap of a magnet whose field
 * points north. A current through it feels a force F = B I l at right angles
 * to both, up for a current to the east, by Fleming's left-hand rule. Raise
 * the current until the force matches the weight and the wire floats.
 */
export function CurrentBalanceLab({
  description,
  field,
  labels,
  length,
  mass,
  title,
}: CurrentBalanceLabProps) {
  const quantity = useQuantity();
  const gravity = 10;
  const balance = balancingCurrent(
    { field, length: length / 100, mass: mass / 1000 },
    gravity,
    [0, 1, 0]
  );
  const [current, setCurrent] = useState(Math.round(balance.current * 5) / 10);
  const force = field * current * (length / 100);
  const weight = (mass / 1000) * gravity;

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <LabSlider
          label={<span>{labels.current}</span>}
          max={Math.ceil(balance.current * 2)}
          min={0}
          name={labels.currentName}
          onValueChange={setCurrent}
          readout={<InlineMath math={quantity(current, "\\text{ A}", 1)} />}
          step={0.1}
          value={current}
        />
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={balanceProgram}
          state={{ share: force / weight }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.force}
            value={<InlineMath math={quantity(force, "\\text{ N}", 3)} />}
          />
          <VisualFactTabular
            label={labels.weight}
            value={<InlineMath math={quantity(weight, "\\text{ N}", 3)} />}
          />
          <VisualFactTabular
            label={labels.needed}
            value={
              <InlineMath math={quantity(balance.current, "\\text{ A}", 2)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
