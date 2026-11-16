import {
  fade,
  gradientRect,
  mix,
  spotlight,
  vignette,
  withShadow,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import {
  FLOW,
  HEAD,
  HOMES,
  homesLit,
  plantPower,
} from "@repo/design-system/components/contents/physics/renewable-energy/microhydro/stream";
import {
  paintHills,
  paintSky,
} from "@repo/design-system/components/contents/physics/renewable-energy/scenery/outdoor";
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
import { Array as Arr, Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** The stream's lit surface, where the dusk sky shows in the water. */
const WATER_LIGHT = mix(MATERIAL.water, MATERIAL.waterGlint, 0.45);

/** What the sketch reads on every frame: the flow, in litres per second, and the head, in metres. */
const MicrohydroFrameSchema = Schema.Struct({
  flow: Schema.Finite,
  head: Schema.Finite,
});
type MicrohydroFrame = typeof MicrohydroFrameSchema.Type;

/** The hillside, its stream at the top, and the pipe down to the powerhouse; returns where the pipe ends. */
function paintHillside(
  sketch: p5,
  head: number,
  flow: number,
  time: number,
  ground: number
) {
  const { height, width } = sketch;
  const drop = (head / HEAD.max) * height * 0.5;
  const intake = { x: width * 0.08, y: ground - drop };
  const house = { x: width * 0.36, y: ground };
  sketch.fill(mix(MATERIAL.foliageDark, getColor("BLACK"), 0.3));
  sketch.quad(
    0,
    intake.y - height * 0.04,
    width * 0.14,
    intake.y - height * 0.03,
    house.x + width * 0.04,
    ground,
    0,
    ground
  );
  gradientRect(
    sketch,
    {
      height: height * 0.035,
      width: width * 0.12,
      x: 0,
      y: intake.y - height * 0.035,
    },
    [
      [0, WATER_LIGHT],
      [1, MATERIAL.water],
    ]
  );
  const pipe = Math.max(height * 0.02, 5);
  sketch.stroke(mix(MATERIAL.galvanizedSteel, getColor("BLACK"), 0.35));
  sketch.strokeWeight(pipe);
  sketch.line(intake.x, intake.y, house.x, house.y - height * 0.04);
  sketch.stroke(fade(MATERIAL.galvanizedSteel, 0.8));
  sketch.strokeWeight(pipe * 0.35);
  sketch.line(
    intake.x,
    intake.y - pipe * 0.2,
    house.x,
    house.y - height * 0.04 - pipe * 0.2
  );
  sketch.noStroke();
  sketch.fill(fade(WATER_LIGHT, 0.95));
  const parcels = Math.max(2, Math.round(flow / 4));
  for (let parcel = 0; parcel < parcels; parcel += 1) {
    const along =
      (parcel / parcels + time * (0.15 + 0.25 * Math.sqrt(head / HEAD.max))) %
      1;
    sketch.circle(
      intake.x + (house.x - intake.x) * along,
      intake.y + (house.y - height * 0.04 - intake.y) * along,
      4
    );
  }
  withShadow(
    sketch,
    { blur: 10, color: fade(getColor("BLACK"), 0.5), drop: 4 },
    () => {
      gradientRect(
        sketch,
        {
          height: height * 0.09,
          width: width * 0.09,
          x: house.x - width * 0.02,
          y: ground - height * 0.09,
        },
        [
          [0, mix(MATERIAL.concrete, getColor("WHITE"), 0.2)],
          [1, mix(MATERIAL.concrete, getColor("BLACK"), 0.4)],
        ]
      );
    }
  );
  sketch.fill(mix(MATERIAL.roofZinc, getColor("BLACK"), 0.3));
  sketch.quad(
    house.x - width * 0.03,
    ground - height * 0.09,
    house.x + width * 0.08,
    ground - height * 0.09,
    house.x + width * 0.07,
    ground - height * 0.115,
    house.x - width * 0.02,
    ground - height * 0.115
  );
  sketch.fill(MATERIAL.windowGlow);
  sketch.rect(
    house.x + width * 0.01,
    ground - height * 0.06,
    width * 0.025,
    height * 0.025
  );
  return { x: house.x + width * 0.07, y: ground - height * 0.07 };
}

/** The hamlet: its homes in two rows, the first `lit` of them glowing, fed by a line from the powerhouse. */
function paintHamlet(
  sketch: p5,
  from: { x: number; y: number },
  lit: number,
  ground: number
) {
  const { height, width } = sketch;
  const size = Math.min(width * 0.05, height * 0.09);
  sketch.stroke(fade(mix(MATERIAL.castIron, getColor("BLACK"), 0.7), 0.85));
  sketch.strokeWeight(1.2);
  sketch.line(from.x, from.y, width * 0.97, from.y - height * 0.02);
  sketch.noStroke();
  Arr.forEach(
    Arr.makeBy(HOMES, (home) => home),
    (home) => {
      const row = home < HOMES / 2 ? 0 : 1;
      const column = home % (HOMES / 2);
      const x = width * (0.5 + column * 0.057) + row * width * 0.03;
      const base = ground - row * size * 0.9 - size * 0.2;
      sketch.fill(mix(MATERIAL.wallPlaster, getColor("BLACK"), 0.5));
      sketch.rect(x - size / 2, base - size * 0.7, size, size * 0.7);
      sketch.fill(mix(MATERIAL.roofTerracotta, getColor("BLACK"), 0.4));
      sketch.triangle(
        x - size * 0.6,
        base - size * 0.7,
        x + size * 0.6,
        base - size * 0.7,
        x,
        base - size * 1.1
      );
      const glowing = home < lit;
      sketch.fill(glowing ? MATERIAL.windowGlow : MATERIAL.tintedGlass);
      sketch.rect(x - size * 0.15, base - size * 0.45, size * 0.3, size * 0.25);
      if (glowing) {
        spotlight(sketch, { x, y: base - size * 0.35 }, size * 0.9, {
          color: MATERIAL.windowGlow,
          strength: 0.4,
        });
      }
    }
  );
}

/** Draws the hillside at dusk: the stream, the pipe through the chosen head, and the homes its power lights. */
function microhydroProgram(sketch: p5, read: () => MicrohydroFrame) {
  let time = 0;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
    sketch.noStroke();
  };
  sketch.draw = () => {
    const { flow, head } = read();
    time += sketch.isLooping() ? Math.min(sketch.deltaTime / 1000, 0.1) : 0;
    const { height, width } = sketch;
    const ground = height * 0.86;
    paintSky(sketch, ground, "dusk");
    paintHills(sketch, ground, "dusk");
    gradientRect(sketch, { height: height - ground, width, x: 0, y: ground }, [
      [0, mix(MATERIAL.foliageDark, getColor("BLACK"), 0.2)],
      [1, mix(MATERIAL.foliageDark, getColor("BLACK"), 0.6)],
    ]);
    const end = paintHillside(sketch, head, flow, time, ground);
    paintHamlet(sketch, end, homesLit(flow, head), ground);
    vignette(sketch, 0.35);
  };
}

interface MicrohydroLabProps {
  description: ReactNode;
  /** The flow at first, in litres per second. */
  flow?: number;
  /** The head at first, in metres. */
  head?: number;
  labels: {
    flowControl: string;
    headControl: string;
    homes: ReactNode;
    power: ReactNode;
    viewLabel: string;
  };
  title: ReactNode;
}

/**
 * A microhydro plant on a hillside at dusk. Water drops from the intake
 * through the head to a small powerhouse, and P ≈ ρ g Q h η sets how many of
 * the hamlet's 16 homes, at 250 W each, can light up. Twice the flow or twice
 * the head doubles the power.
 */
export function MicrohydroLab({
  description,
  flow: initialFlow = 20,
  head: initialHead = 10,
  labels,
  title,
}: MicrohydroLabProps) {
  const [flow, setFlow] = useState(initialFlow);
  const [head, setHead] = useState(initialHead);
  const measure = useQuantity();
  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <LabSlider
          label={labels.flowControl}
          max={FLOW.max}
          min={FLOW.min}
          name={labels.flowControl}
          onValueChange={setFlow}
          readout={<InlineMath math={measure(flow, "\\text{ L/s}", 0)} />}
          step={FLOW.step}
          value={flow}
        />
        <LabSlider
          label={labels.headControl}
          max={HEAD.max}
          min={HEAD.min}
          name={labels.headControl}
          onValueChange={setHead}
          readout={<InlineMath math={measure(head, "\\text{ m}", 0)} />}
          step={HEAD.step}
          value={head}
        />
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={microhydroProgram}
          state={{ flow, head }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.power}
            value={
              <InlineMath
                math={measure(plantPower(flow, head), "\\text{ W}", 0)}
              />
            }
          />
          <VisualFactTabular
            label={labels.homes}
            value={
              <InlineMath
                math={`${measure(homesLit(flow, head), "", 0)}\\ /\\ ${measure(HOMES, "", 0)}`}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
