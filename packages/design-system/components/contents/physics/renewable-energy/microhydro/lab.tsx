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
  SCENERY,
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
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** The glow of a lit window. */
const WINDOW = mix(PLOT_COLORS.amber, getColor("WHITE"), 0.55);

/** What the sketch reads on every frame: the flow, in litres per second, and the head, in metres. */
interface MicrohydroFrame {
  readonly flow: number;
  readonly head: number;
}

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
  sketch.fill(mix(SCENERY.grassDark, getColor("BLACK"), 0.3));
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
      [0, SCENERY.waterLight],
      [1, SCENERY.water],
    ]
  );
  sketch.stroke(getColor("SLATE", 400));
  sketch.strokeWeight(Math.max(height * 0.02, 5));
  sketch.line(intake.x, intake.y, house.x, house.y - height * 0.04);
  sketch.noStroke();
  sketch.fill(fade(getColor("WHITE"), 0.85));
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
          [0, mix(SCENERY.concrete, getColor("WHITE"), 0.3)],
          [1, mix(SCENERY.concrete, getColor("BLACK"), 0.3)],
        ]
      );
    }
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
  sketch.stroke(fade(getColor("ZINC", 900), 0.8));
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
      sketch.fill(
        mix(
          mix(getColor("STONE", 600), getColor("WHITE"), 0.4),
          getColor("BLACK"),
          0.45
        )
      );
      sketch.rect(x - size / 2, base - size * 0.7, size, size * 0.7);
      sketch.fill(
        mix(
          mix(PLOT_COLORS.orange, getColor("STONE", 600), 0.5),
          getColor("BLACK"),
          0.35
        )
      );
      sketch.triangle(
        x - size * 0.6,
        base - size * 0.7,
        x + size * 0.6,
        base - size * 0.7,
        x,
        base - size * 1.1
      );
      const glowing = home < lit;
      sketch.fill(
        glowing
          ? WINDOW
          : mix(getColor("ZINC", 900), getColor("SLATE", 600), 0.3)
      );
      sketch.rect(x - size * 0.15, base - size * 0.45, size * 0.3, size * 0.25);
      if (glowing) {
        spotlight(sketch, { x, y: base - size * 0.35 }, size * 0.9, {
          color: PLOT_COLORS.amber,
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
      [0, mix(SCENERY.grassDark, getColor("BLACK"), 0.2)],
      [1, mix(SCENERY.grassDark, getColor("BLACK"), 0.6)],
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
