import {
  fade,
  gradientRect,
  mix,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { paintMeter } from "@repo/design-system/components/contents/physics/circuit/board";
import { paintBench } from "@repo/design-system/components/contents/physics/heat/glass";
import {
  gasPressure,
  KELVIN,
} from "@repo/design-system/components/contents/physics/heat/thermal";
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

/** How many molecules the cylinder holds; the mass of gas is fixed. */
const MOLECULES = 70;

/** The three states the lab steps through. */
const StageSchema = Schema.Literals(["start", "compressed", "heated"]);
type Stage = typeof StageSchema.Type;

/** What the sketch reads on every frame. */
const GasFrameSchema = Schema.Struct({
  full: Schema.Finite,
  kelvin: Schema.Finite,
  pressure: Schema.Finite,
  volume: Schema.Finite,
});
type GasFrame = typeof GasFrameSchema.Type;

/**
 * Draws one moment: the cylinder with its piston at the gas's volume, the
 * molecules moving at a speed that grows with the square root of the
 * absolute temperature, and the pressure gauge on top.
 */
function gasProgram(sketch: p5, read: () => GasFrame) {
  let clock = 0;
  let piston = read().volume;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const frame = read();
    const step = Math.min(sketch.deltaTime / 1000, 0.1);
    if (sketch.isLooping()) {
      clock += step;
    }
    piston += (frame.volume - piston) * Math.min(step * 4, 1);
    const { height, width } = sketch;
    const top = height * 0.82;
    paintBench(sketch, top);
    const box = {
      height: height * 0.36,
      left: width * 0.1,
      length: width * 0.72,
      y: top - height * 0.42,
    };
    const inner = box.length * piston;
    gradientRect(
      sketch,
      {
        height: box.height + 16,
        width: box.length + 16,
        x: box.left - 8,
        y: box.y - 8,
      },
      [
        [0, fade(MATERIAL.glass, 0.35)],
        [1, fade(MATERIAL.glass, 0.18)],
      ]
    );
    gradientRect(
      sketch,
      { height: box.height, width: inner, x: box.left, y: box.y },
      [
        [
          0,
          fade(
            mix(
              MATERIAL.gasWisp,
              PLOT_COLORS.orange,
              (frame.kelvin - 250) / 400
            ),
            0.25
          ),
        ],
        [1, fade(MATERIAL.gasWisp, 0.12)],
      ]
    );
    gradientRect(
      sketch,
      {
        height: box.height - 6,
        width: width * 0.04,
        x: box.left + inner,
        y: box.y + 3,
      },
      [
        [0, MATERIAL.aluminium],
        [1, mix(MATERIAL.aluminium, getColor("BLACK"), 0.45)],
      ]
    );
    sketch.noStroke();
    sketch.fill(MATERIAL.castIron);
    sketch.rect(
      box.left + inner + width * 0.04,
      box.y + box.height * 0.44,
      box.length * 1.2 - inner,
      box.height * 0.12
    );
    const speed = Math.sqrt(frame.kelvin / 300) * 0.35;
    Arr.forEach(
      Arr.makeBy(MOLECULES, (index) => index),
      (index) => {
        const bounce = (seed: number, span: number) => {
          const travel =
            (hashUnit(index, seed) +
              clock * speed * (0.6 + hashUnit(index, seed + 1))) %
            2;
          return (travel < 1 ? travel : 2 - travel) * span;
        };
        sketch.fill(fade(PLOT_COLORS.teal, 0.9));
        sketch.circle(
          box.left + 6 + bounce(0, inner - 12),
          box.y + 6 + bounce(2, box.height - 12),
          6
        );
      }
    );
    paintMeter(
      sketch,
      { x: box.left + width * 0.08, y: box.y - height * 0.12 },
      Math.min(width, height) * 0.16,
      {
        full: frame.full,
        letter: "kPa",
        value: frame.pressure,
      }
    );
    vignette(sketch, 0.3);
  };
}

interface GasPistonLabProps {
  description: ReactNode;
  /** The temperature the gas is heated to, in degrees Celsius. */
  finalTemperature: number;
  labels: {
    pressure: ReactNode;
    stage: string;
    stages: Record<Stage, ReactNode>;
    temperature: ReactNode;
    viewLabel: string;
    volume: ReactNode;
  };
  /** The starting pressure of the gas, in kilopascals. */
  pressure: number;
  /** The starting temperature of the gas, in degrees Celsius. */
  temperature: number;
  title: ReactNode;
  /** The final volume as a fraction of the starting volume. */
  volumeRatio: number;
}

/**
 * A fixed mass of gas in a cylinder, taken through its change one step at a
 * time: first squeezed to its new volume at the starting temperature, then
 * heated at that volume. The molecules crowd closer when the piston moves in
 * and speed up when the gas is heated, and the gauge reads the pressure after
 * each step.
 */
export function GasPistonLab({
  description,
  finalTemperature,
  labels,
  pressure,
  temperature,
  title,
  volumeRatio,
}: GasPistonLabProps) {
  const quantity = useQuantity();
  const [stage, setStage] = useState<Stage>("start");
  const isStage = Schema.is(StageSchema);
  const volume = stage === "start" ? 1 : volumeRatio;
  const celsius = stage === "heated" ? finalTemperature : temperature;
  const now = gasPressure(pressure, volume, { from: temperature, to: celsius });
  const full =
    Math.ceil(
      (gasPressure(pressure, volumeRatio, {
        from: temperature,
        to: finalTemperature,
      }) *
        1.25) /
        50
    ) * 50;

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.stage}
          gridColumns="3"
          onValueChange={(value) => {
            if (isStage(value)) {
              setStage(value);
            }
          }}
          type="single"
          value={stage}
          variant="outline"
        >
          {Arr.map(StageSchema.literals, (option) => (
            <ToggleGroupItem key={option} value={option}>
              {labels.stages[option]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={gasProgram}
          state={{ full, kelvin: celsius + KELVIN, pressure: now, volume }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.volume}
            value={<InlineMath math={`${quantity(volume, "", 2)}\\,V_1`} />}
          />
          <VisualFactTabular
            label={labels.temperature}
            value={
              <InlineMath math={quantity(celsius + KELVIN, "\\text{ K}", 0)} />
            }
          />
          <VisualFactTabular
            label={labels.pressure}
            value={<InlineMath math={quantity(now, "\\text{ kPa}", 0)} />}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
