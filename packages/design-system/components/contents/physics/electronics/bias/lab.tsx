import { caption } from "@repo/design-system/components/contents/physics/canvas/caption";
import {
  fade,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import {
  paintBoard,
  paintMeter,
  paintResistor,
  wire,
} from "@repo/design-system/components/contents/physics/circuit/board";
import { transistorBias } from "@repo/design-system/components/contents/physics/electronics/logic";
import { paintTransistor } from "@repo/design-system/components/contents/physics/electronics/parts";
import type { Point } from "@repo/design-system/components/contents/physics/optics/light";
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
import { Array as Arr, Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** What the sketch reads on every frame. */
const BiasFrameSchema = Schema.Struct({
  base: Schema.Finite,
  collector: Schema.Finite,
  collectorEmitter: Schema.Finite,
  collectorSupply: Schema.Finite,
  most: Schema.Finite,
});
type BiasFrame = typeof BiasFrameSchema.Type;

/** Dots of charge moving along a wire from `from` to `to` at a pace that grows with `current`. */
function flow(
  sketch: p5,
  points: readonly Point[],
  current: number,
  clock: number
) {
  const pairs = Arr.zip(points, Arr.drop(points, 1));
  const lengths = Arr.map(pairs, ([a, b]) => Math.hypot(b.x - a.x, b.y - a.y));
  const total = Arr.reduce(lengths, 0, (sum, length) => sum + length);
  const gap = 18;
  const offset = (clock * 60 * current) % gap;
  sketch.noStroke();
  sketch.fill(fade(PLOT_COLORS.amber, 0.9));
  for (let along = offset; along < total; along += gap) {
    let left = along;
    for (const [[a, b], length] of Arr.zip(pairs, lengths)) {
      if (left <= length) {
        sketch.circle(
          a.x + ((b.x - a.x) * left) / length,
          a.y + ((b.y - a.y) * left) / length,
          4
        );
        break;
      }
      left -= length;
    }
  }
}

/**
 * Draws the amplifier on its board: the base supply feeding the base through
 * its resistor, the collector supply feeding the collector through its
 * resistor, charge drifting along each loop at a pace set by its current,
 * and a voltmeter across the collector and emitter.
 */
function biasProgram(sketch: p5, read: () => BiasFrame) {
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
    const at = (x: number, y: number) => ({ x: width * x, y: height * y });
    paintBoard(sketch);
    const legs = paintTransistor(
      sketch,
      at(0.5, 0.48),
      Math.min(width, height) * 0.12
    );
    const baseWire = [at(0.06, 0.56), at(0.14, 0.56)];
    wire(sketch, baseWire, MATERIAL.hullRed);
    paintResistor(sketch, at(0.14, 0.56), at(0.36, 0.56), width * 0.16);
    wire(
      sketch,
      [at(0.36, 0.56), { x: legs.base.x, y: height * 0.56 }, legs.base],
      MATERIAL.hullRed
    );
    wire(
      sketch,
      [at(0.94, 0.08), at(0.62, 0.08), at(0.62, 0.14)],
      MATERIAL.hullRed
    );
    paintResistor(sketch, at(0.62, 0.14), at(0.62, 0.34), height * 0.14);
    wire(
      sketch,
      [
        at(0.62, 0.34),
        { x: legs.collector.x, y: height * 0.34 },
        legs.collector,
      ],
      MATERIAL.hullRed
    );
    wire(
      sketch,
      [legs.emitter, { x: legs.emitter.x, y: height * 0.9 }, at(0.94, 0.9)],
      MATERIAL.trolleyPaint
    );
    flow(
      sketch,
      [
        at(0.06, 0.56),
        at(0.36, 0.56),
        { x: legs.base.x, y: height * 0.56 },
        legs.base,
      ],
      frame.base / frame.most,
      clock
    );
    flow(
      sketch,
      [
        at(0.94, 0.08),
        at(0.62, 0.08),
        at(0.62, 0.34),
        { x: legs.collector.x, y: height * 0.34 },
        legs.collector,
      ],
      frame.collector / frame.most,
      clock
    );
    paintMeter(sketch, at(0.82, 0.6), Math.min(width, height) * 0.18, {
      full: frame.collectorSupply,
      letter: "V",
      value: frame.collectorEmitter,
    });
    wire(sketch, [at(0.82, 0.69), at(0.82, 0.9)], MATERIAL.trolleyPaint);
    wire(
      sketch,
      [
        at(0.82, 0.51),
        at(0.82, 0.42),
        { x: legs.collector.x + 6, y: height * 0.42 },
      ],
      MATERIAL.signalAmber
    );
    const mark = {
      align: "left",
      baseline: "middle",
      color: fade(getColor("WHITE"), 0.9),
      size: 13,
    } as const;
    caption(sketch, "Rb", { x: width * 0.2, y: height * 0.5 }, mark);
    caption(sketch, "Rc", { x: width * 0.66, y: height * 0.24 }, mark);
    vignette(sketch, 0.3);
  };
}

interface TransistorBiasLabProps {
  /** The base resistor the lab starts with, in kilohms. */
  base: number;
  /** The base supply voltage, in volts. */
  baseSupply: number;
  /** The collector resistor, in kilohms. */
  collector: number;
  /** The collector supply voltage, in volts. */
  collectorSupply: number;
  description: ReactNode;
  /** The collector current over the base current. */
  gain: number;
  labels: {
    base: ReactNode;
    baseCurrent: ReactNode;
    baseName: string;
    collectorCurrent: ReactNode;
    collectorEmitter: ReactNode;
    viewLabel: string;
  };
  /** The base-emitter voltage, in volts. */
  threshold: number;
  title: ReactNode;
}

/**
 * An npn transistor with a base resistor and a collector resistor. The base
 * resistor takes the base supply less the base-emitter voltage, which sets a
 * small base current; the collector current is that many times larger; and
 * the collector supply is shared between the collector resistor and the
 * transistor. Shrink the base resistor and watch the transistor run into
 * saturation.
 */
export function TransistorBiasLab({
  base: start,
  baseSupply,
  collector,
  collectorSupply,
  description,
  gain,
  labels,
  title,
  threshold,
}: TransistorBiasLabProps) {
  const quantity = useQuantity();
  const [base, setBase] = useState(start);
  const bias = transistorBias({
    base: base * 1000,
    baseSupply,
    collector: collector * 1000,
    collectorSupply,
    gain,
    threshold,
  });

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <LabSlider
          label={<span>{labels.base}</span>}
          max={Math.max(500, start * 3)}
          min={10}
          name={labels.baseName}
          onValueChange={setBase}
          readout={<InlineMath math={quantity(base, "\\text{ k}\\Omega", 0)} />}
          step={10}
          value={base}
        />
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={biasProgram}
          state={{
            base: bias.baseCurrent * gain,
            collector: bias.collectorCurrent,
            collectorEmitter: bias.collectorEmitter,
            collectorSupply,
            most: (collectorSupply / (collector * 1000)) * 1.2,
          }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.baseCurrent}
            value={
              <InlineMath
                math={quantity(bias.baseCurrent * 1e6, "\\ \\mu\\text{A}", 1)}
              />
            }
          />
          <VisualFactTabular
            label={labels.collectorCurrent}
            value={
              <InlineMath
                math={quantity(bias.collectorCurrent * 1000, "\\text{ mA}", 2)}
              />
            }
          />
          <VisualFactTabular
            label={labels.collectorEmitter}
            value={
              <InlineMath
                math={quantity(bias.collectorEmitter, "\\text{ V}", 2)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
