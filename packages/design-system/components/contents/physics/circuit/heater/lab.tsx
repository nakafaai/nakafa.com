import {
  fade,
  gradientRect,
  mix,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import {
  paintBoard,
  paintCoil,
  paintMeter,
  terminal,
  wire,
} from "@repo/design-system/components/contents/physics/circuit/board";
import { heaterOnSupply } from "@repo/design-system/components/contents/physics/circuit/current";
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
import { Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** What the sketch reads on every frame. */
const HeaterFrameSchema = Schema.Struct({
  power: Schema.Finite,
  rated: Schema.Finite,
  ratedVoltage: Schema.Finite,
  supply: Schema.Finite,
});
type HeaterFrame = typeof HeaterFrameSchema.Type;

/**
 * Draws the heater on its board: the supply socket with a voltmeter, the
 * leads, and the heating coil inside its ceramic housing, glowing with the
 * share of its rated power it draws now.
 */
function heaterProgram(sketch: p5, read: () => HeaterFrame) {
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const frame = read();
    const { height, width } = sketch;
    const at = (x: number, y: number) => ({ x: width * x, y: height * y });
    paintBoard(sketch);
    gradientRect(
      sketch,
      {
        height: height * 0.36,
        width: width * 0.18,
        x: width * 0.06,
        y: height * 0.32,
      },
      [
        [0, MATERIAL.cabinet],
        [1, mix(MATERIAL.cabinet, getColor("BLACK"), 0.3)],
      ]
    );
    sketch.noStroke();
    sketch.fill(mix(MATERIAL.cabinet, getColor("BLACK"), 0.12));
    sketch.rect(width * 0.09, height * 0.36, width * 0.12, height * 0.28, 6);
    sketch.fill(getColor("NEUTRAL", 800));
    sketch.rect(width * 0.135, height * 0.4, width * 0.03, height * 0.06, 3);
    sketch.rect(width * 0.135, height * 0.54, width * 0.03, height * 0.06, 3);
    wire(
      sketch,
      [at(0.24, 0.42), at(0.4, 0.42), at(0.4, 0.3), at(0.5, 0.3)],
      MATERIAL.hullRed
    );
    wire(
      sketch,
      [at(0.24, 0.58), at(0.4, 0.58), at(0.4, 0.7), at(0.5, 0.7)],
      MATERIAL.trolleyPaint
    );
    gradientRect(
      sketch,
      {
        height: height * 0.5,
        width: width * 0.42,
        x: width * 0.5,
        y: height * 0.25,
      },
      [
        [0, MATERIAL.ceramicTile],
        [1, mix(MATERIAL.ceramicTile, getColor("BLACK"), 0.35)],
      ]
    );
    sketch.noStroke();
    sketch.fill(fade(getColor("BLACK"), 0.55));
    sketch.rect(width * 0.53, height * 0.3, width * 0.36, height * 0.4, 6);
    const glow = Math.sqrt(Math.min(frame.power / frame.rated, 1.2) / 1.2);
    for (const row of [0.38, 0.5, 0.62]) {
      paintCoil(sketch, at(0.56, row), at(0.86, row), glow);
    }
    terminal(sketch, at(0.5, 0.3));
    terminal(sketch, at(0.5, 0.7));
    paintMeter(sketch, at(0.15, 0.18), Math.min(width, height) * 0.17, {
      full: frame.ratedVoltage * 1.25,
      letter: "V",
      value: frame.supply,
    });
    vignette(sketch, 0.3);
  };
}

interface HeaterSupplyLabProps {
  description: ReactNode;
  /** How long the heater runs, in hours. */
  hours: number;
  labels: {
    energy: ReactNode;
    power: ReactNode;
    resistance: ReactNode;
    supply: ReactNode;
    supplyName: string;
    viewLabel: string;
  };
  /** The power on the heater's label, in watts. */
  ratedPower: number;
  /** The voltage on the heater's label, in volts. */
  ratedVoltage: number;
  /** The supply voltage the lab starts at, in volts. */
  supplyVoltage: number;
  title: ReactNode;
}

/**
 * A heater whose label gives its voltage and power, plugged into a supply of
 * another voltage. Its coil keeps the resistance the label implies, R = V²/P,
 * so on a lower voltage it draws less current and far less power, and its
 * coil glows dimmer. Change the supply and read the power and the energy over
 * the running time.
 */
export function HeaterSupplyLab({
  description,
  hours,
  labels,
  ratedPower,
  ratedVoltage,
  supplyVoltage,
  title,
}: HeaterSupplyLabProps) {
  const quantity = useQuantity();
  const [supply, setSupply] = useState(supplyVoltage);
  const heater = heaterOnSupply(
    { power: ratedPower, voltage: ratedVoltage },
    supply,
    hours
  );

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <LabSlider
          label={<span>{labels.supply}</span>}
          max={Math.ceil(ratedVoltage * 1.1)}
          min={0}
          name={labels.supplyName}
          onValueChange={setSupply}
          readout={<InlineMath math={quantity(supply, "\\text{ V}", 0)} />}
          step={10}
          value={supply}
        />
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={heaterProgram}
          state={{
            power: heater.power,
            rated: ratedPower,
            ratedVoltage,
            supply,
          }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.resistance}
            value={
              <InlineMath math={quantity(heater.resistance, "\\,\\Omega", 1)} />
            }
          />
          <VisualFactTabular
            label={labels.power}
            value={
              <InlineMath math={quantity(heater.power, "\\text{ W}", 0)} />
            }
          />
          <VisualFactTabular
            label={labels.energy}
            value={
              <InlineMath math={quantity(heater.energy, "\\text{ kWh}", 2)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
