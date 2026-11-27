import { caption } from "@repo/design-system/components/contents/physics/canvas/caption";
import {
  fade,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import {
  paintBoard,
  paintBulb,
  paintResistor,
  terminal,
  wire,
} from "@repo/design-system/components/contents/physics/circuit/board";
import { dividerVoltage } from "@repo/design-system/components/contents/physics/electronics/logic";
import {
  paintLdr,
  paintTransistor,
} from "@repo/design-system/components/contents/physics/electronics/parts";
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
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { MACHINE_COLORS } from "@repo/design-system/lib/material/machine";
import { Schema } from "effect";
import type p5 from "p5";
import type { ReactNode } from "react";
import { useState } from "react";

/**
 * The resistance of a typical light-dependent resistor, in kilohms: about
 * 1 kΩ in bright light and 100 kΩ in the dark, falling steadily on a
 * logarithmic scale as the light grows.
 */
const LDR = { bright: 1, dark: 100 } as const;

/** The LDR's resistance, in kilohms, at a light level from 0 (dark) to 1 (bright). */
function ldrResistance(light: number) {
  return LDR.dark * (LDR.bright / LDR.dark) ** light;
}

/** The light level, from 0 to 1, at which a divider with `resistor` kilohms above the LDR reaches the switching voltage. */
function switchingLight(supply: number, threshold: number, resistor: number) {
  const needed = (threshold * resistor) / (supply - threshold);
  return Math.min(
    Math.max(Math.log(needed / LDR.dark) / Math.log(LDR.bright / LDR.dark), 0),
    1
  );
}

/** What the sketch reads on every frame. */
const SwitchFrameSchema = Schema.Struct({
  light: Schema.Finite,
  on: Schema.Boolean,
});
type SwitchFrame = typeof SwitchFrameSchema.Type;

/**
 * Draws the automatic lamp on its board: the supply rails, the fixed
 * resistor above the LDR in the divider, the base wire to the transistor,
 * and the bulb in the collector circuit, lit only while the base voltage has
 * reached the switching value. The board darkens with the light level.
 */
function switchProgram(sketch: p5, read: () => SwitchFrame) {
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const frame = read();
    const { height, width } = sketch;
    const at = (x: number, y: number) => ({ x: width * x, y: height * y });
    paintBoard(sketch);
    sketch.noStroke();
    sketch.fill(fade(getColor("BLACK"), 0.55 * (1 - frame.light)));
    sketch.rect(0, 0, width, height);
    wire(sketch, [at(0.06, 0.1), at(0.94, 0.1)], MACHINE_COLORS.hullRed);
    wire(
      sketch,
      [at(0.06, 0.9), at(0.94, 0.9)],
      INSTRUMENT_COLORS.trolleyPaint
    );
    wire(sketch, [at(0.24, 0.1), at(0.24, 0.2)], MACHINE_COLORS.hullRed);
    paintResistor(sketch, at(0.24, 0.2), at(0.24, 0.4), height * 0.16);
    wire(sketch, [at(0.24, 0.4), at(0.24, 0.6)], MACHINE_COLORS.signalAmber);
    wire(sketch, [at(0.24, 0.5), at(0.6, 0.5)], MACHINE_COLORS.signalAmber);
    terminal(sketch, at(0.24, 0.5));
    paintLdr(
      sketch,
      at(0.24, 0.68),
      Math.min(width, height) * 0.12,
      frame.light
    );
    wire(
      sketch,
      [at(0.24, 0.75), at(0.24, 0.9)],
      INSTRUMENT_COLORS.trolleyPaint
    );
    const legs = paintTransistor(
      sketch,
      at(0.64, 0.46),
      Math.min(width, height) * 0.1
    );
    wire(sketch, [at(0.6, 0.5), legs.base], MACHINE_COLORS.signalAmber);
    wire(
      sketch,
      [legs.emitter, { x: legs.emitter.x, y: height * 0.9 }],
      INSTRUMENT_COLORS.trolleyPaint
    );
    wire(
      sketch,
      [legs.collector, { x: width * 0.8, y: legs.collector.y }, at(0.8, 0.36)],
      MACHINE_COLORS.hullRed
    );
    paintBulb(
      sketch,
      at(0.8, 0.28),
      Math.min(width, height) * 0.12,
      frame.on ? 1 : 0
    );
    wire(sketch, [at(0.8, 0.2), at(0.8, 0.1)], MACHINE_COLORS.hullRed);
    const sign = {
      align: "left",
      baseline: "middle",
      color: fade(getColor("WHITE"), 0.9),
      size: 14,
    } as const;
    caption(sketch, "+", { x: width * 0.02, y: height * 0.1 }, sign);
    caption(sketch, "−", { x: width * 0.02, y: height * 0.9 }, sign);
    caption(sketch, "R", { x: width * 0.29, y: height * 0.3 }, sign);
    caption(sketch, "LDR", { x: width * 0.31, y: height * 0.68 }, sign);
    vignette(sketch, 0.3);
  };
}

interface TransistorSwitchLabProps {
  description: NonNullable<ReactNode>;
  labels: {
    base: ReactNode;
    ldr: ReactNode;
    light: ReactNode;
    lightName: string;
    resistor: ReactNode;
    resistorName: string;
    switching: ReactNode;
    viewLabel: string;
  };
  /** The fixed resistor above the LDR the lab starts with, in kilohms. */
  resistor: number;
  /** The supply voltage, in volts. */
  supply: number;
  /** The base voltage at which the transistor switches on, in volts. */
  threshold: number;
  title: NonNullable<ReactNode>;
}

/**
 * An automatic lamp: a fixed resistor above a light-dependent resistor
 * shares the supply, and the share across the LDR drives the transistor's
 * base. As the light fades the LDR's resistance climbs, its share grows, and
 * once the base reaches the switching voltage the bulb lights. Make the
 * fixed resistor smaller and watch the switching point move to brighter
 * light.
 */
export function TransistorSwitchLab({
  description,
  labels,
  resistor: start,
  supply,
  title,
  threshold,
}: TransistorSwitchLabProps) {
  const quantity = useQuantity();
  const [resistor, setResistor] = useState(start);
  const [light, setLight] = useState(0.6);
  const ldr = ldrResistance(light);
  const base = dividerVoltage(supply, resistor, ldr);
  const switching = switchingLight(supply, threshold, resistor);

  return (
    <VisualCard
      onReset={() => {
        setResistor(start);
        setLight(0.6);
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <div className="flex w-full flex-col gap-4">
          <LabSlider
            label={<span>{labels.light}</span>}
            max={100}
            min={0}
            name={labels.lightName}
            onValueChange={(value) => setLight(value / 100)}
            readout={<InlineMath math={quantity(light * 100, "\\%", 0)} />}
            step={1}
            value={Math.round(light * 100)}
          />
          <LabSlider
            label={<span>{labels.resistor}</span>}
            max={Math.max(200, start * 2)}
            min={5}
            name={labels.resistorName}
            onValueChange={setResistor}
            readout={
              <InlineMath math={quantity(resistor, "\\text{ k}\\Omega", 0)} />
            }
            step={5}
            value={resistor}
          />
        </div>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={switchProgram}
          state={{ light, on: base >= threshold }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.ldr}
            value={<InlineMath math={quantity(ldr, "\\text{ k}\\Omega", 1)} />}
          />
          <VisualFactTabular
            label={labels.base}
            value={<InlineMath math={quantity(base, "\\text{ V}", 2)} />}
          />
          <VisualFactTabular
            label={labels.switching}
            value={<InlineMath math={quantity(switching * 100, "\\%", 0)} />}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
