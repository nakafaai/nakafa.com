import { caption } from "@repo/design-system/components/contents/physics/canvas/caption";
import {
  fade,
  gradientRect,
  mix,
  spotlight,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import {
  paintBoard,
  terminal,
  wire,
} from "@repo/design-system/components/contents/physics/circuit/board";
import { wireRatios } from "@repo/design-system/components/contents/physics/circuit/current";
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
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { ENERGY_COLORS } from "@repo/design-system/lib/material/energy";
import { MACHINE_COLORS } from "@repo/design-system/lib/material/machine";
import { Schema } from "effect";
import type p5 from "p5";
import type { ReactNode } from "react";
import { useState } from "react";

/** What the sketch reads on every frame: the second wire's length and diameter as multiples of the first. */
const WireFrameSchema = Schema.Struct({
  diameter: Schema.Finite,
  length: Schema.Finite,
});
type WireFrame = typeof WireFrameSchema.Type;

/** One nichrome wire stretched between two posts, `thick` pixels thick, glowing with `glow` from 0 to 1. */
function paintWire(
  sketch: p5,
  from: number,
  to: number,
  y: number,
  thick: number,
  glow: number
) {
  spotlight(sketch, { x: (from + to) / 2, y }, (to - from) * 0.6, {
    color: BENCH_COLORS.coalGlow,
    strength: 0.45 * glow,
  });
  gradientRect(
    sketch,
    { height: thick, width: to - from, x: from, y: y - thick / 2 },
    [
      [
        0,
        mix(
          mix(ENERGY_COLORS.galvanizedSteel, BENCH_COLORS.coalGlow, glow),
          getColor("WHITE"),
          0.35
        ),
      ],
      [0.5, mix(ENERGY_COLORS.galvanizedSteel, BENCH_COLORS.coalGlow, glow)],
      [
        1,
        mix(
          mix(ENERGY_COLORS.galvanizedSteel, BENCH_COLORS.coalGlow, glow),
          getColor("BLACK"),
          0.4
        ),
      ],
    ]
  );
  terminal(sketch, { x: from, y });
  terminal(sketch, { x: to, y });
}

/**
 * Draws both wires on the same supply, each between its two posts, drawn to
 * scale in length and thickness: the first above, the second below, each
 * glowing with its power relative to the brighter one.
 */
function wireProgram(sketch: p5, read: () => WireFrame) {
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const frame = read();
    const { height, width } = sketch;
    const second = wireRatios(frame.length, frame.diameter);
    const longest = Math.max(1, frame.length);
    const unit = (width * 0.7) / longest;
    const thickest = Math.max(1, frame.diameter);
    const thickness = Math.min(height * 0.035, (height * 0.1) / thickest);
    const brightest = Math.max(1, second.power);
    paintBoard(sketch);
    const left = width * 0.15;
    wire(
      sketch,
      [
        { x: width * 0.06, y: height * 0.3 },
        { x: left, y: height * 0.3 },
      ],
      MACHINE_COLORS.hullRed
    );
    wire(
      sketch,
      [
        { x: width * 0.06, y: height * 0.68 },
        { x: left, y: height * 0.68 },
      ],
      MACHINE_COLORS.hullRed
    );
    paintWire(
      sketch,
      left,
      left + unit,
      height * 0.3,
      thickness,
      Math.sqrt(1 / brightest)
    );
    paintWire(
      sketch,
      left,
      left + unit * frame.length,
      height * 0.68,
      thickness * frame.diameter,
      Math.sqrt(second.power / brightest)
    );
    const name = {
      align: "left",
      baseline: "bottom",
      color: fade(getColor("WHITE"), 0.9),
      size: 13,
    } as const;
    caption(
      sketch,
      "1",
      { x: left, y: height * 0.3 - thickness * 1.5 - 8 },
      name
    );
    caption(
      sketch,
      "2",
      { x: left, y: height * 0.68 - thickness * frame.diameter * 0.5 - 12 },
      name
    );
    vignette(sketch, 0.3);
  };
}

interface WireResistanceLabProps {
  description: NonNullable<ReactNode>;
  /** How many times the first wire's diameter the second wire starts at. */
  diameterRatio: number;
  labels: {
    diameter: ReactNode;
    diameterName: string;
    length: ReactNode;
    lengthName: string;
    power: ReactNode;
    resistance: ReactNode;
    viewLabel: string;
  };
  /** How many times the first wire's length the second wire starts at. */
  lengthRatio: number;
  title: NonNullable<ReactNode>;
}

/**
 * Two nichrome wires on the same fixed voltage, drawn to scale. A wire's
 * resistance grows with its length and falls with its cross-sectional area,
 * which grows with the square of its diameter, and at a fixed voltage its
 * power is V²/R. Change the second wire's length and diameter and watch which
 * wire glows hotter.
 */
export function WireResistanceLab({
  description,
  diameterRatio,
  labels,
  lengthRatio,
  title,
}: WireResistanceLabProps) {
  const quantity = useQuantity();
  const [length, setLength] = useState(lengthRatio);
  const [diameter, setDiameter] = useState(diameterRatio);
  const ratios = wireRatios(length, diameter);

  return (
    <VisualCard
      onReset={() => {
        setLength(lengthRatio);
        setDiameter(diameterRatio);
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <div className="flex w-full flex-col gap-4">
          <LabSlider
            label={<span>{labels.length}</span>}
            max={3}
            min={0.5}
            name={labels.lengthName}
            onValueChange={setLength}
            readout={<InlineMath math={quantity(length, "\\times", 1)} />}
            step={0.5}
            value={length}
          />
          <LabSlider
            label={<span>{labels.diameter}</span>}
            max={3}
            min={0.5}
            name={labels.diameterName}
            onValueChange={setDiameter}
            readout={<InlineMath math={quantity(diameter, "\\times", 1)} />}
            step={0.5}
            value={diameter}
          />
        </div>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={wireProgram}
          state={{ diameter, length }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.resistance}
            value={
              <InlineMath
                math={`\\dfrac{R_2}{R_1}=${quantity(ratios.resistance, "", 2)}`}
              />
            }
          />
          <VisualFactTabular
            label={labels.power}
            value={
              <InlineMath
                math={`\\dfrac{P_2}{P_1}=${quantity(ratios.power, "", 2)}`}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
