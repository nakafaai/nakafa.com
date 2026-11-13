import {
  fade,
  gradientRect,
  mix,
  vignette,
  withShadow,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import {
  HEAD,
  inletSpeed,
  stagePowers,
} from "@repo/design-system/components/contents/physics/renewable-energy/dam/chain";
import {
  paintClouds,
  paintGround,
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
import {
  VisualFactIndicator,
  VisualFactTabular,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { P5Sketch } from "@repo/design-system/components/visual/sketch";
import { getColor } from "@repo/design-system/lib/color";
import { MATERIAL } from "@repo/design-system/lib/material";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** The color of each stage of the chain, shared by the bars and the facts. */
const STAGE_COLORS = {
  electric: PLOT_COLORS.orange,
  kinetic: PLOT_COLORS.teal,
  potential: PLOT_COLORS.amber,
  shaft: PLOT_COLORS.violet,
} as const;

/** The tallest the dam stands above the riverbed, in metres. */
const DAM_HEIGHT = 108;

/** What the sketch reads on every frame: the head of water behind the dam. */
const DamFrameSchema = Schema.Struct({ head: Schema.Finite });
type DamFrame = typeof DamFrameSchema.Type;

/** Positions of the valley for one canvas size: the riverbed, the dam and a metre of height. */
function layout(sketch: p5) {
  const { height, width } = sketch;
  const bed = height * 0.84;
  return {
    bed,
    damBase: width * 0.44,
    damFoot: width * 0.34,
    metre: (bed - height * 0.12) / DAM_HEIGHT,
    house: { x: width * 0.47, y: bed - height * 0.13 },
  };
}

/** The reservoir up to the head, the concrete dam and its spillway face. */
function paintReservoir(
  sketch: p5,
  place: ReturnType<typeof layout>,
  head: number,
  time: number
) {
  const surface = place.bed - head * place.metre;
  const top = place.bed - DAM_HEIGHT * place.metre;
  gradientRect(
    sketch,
    { height: place.bed - surface, width: place.damFoot + 4, x: 0, y: surface },
    [
      [0, mix(MATERIAL.water, MATERIAL.waterGlint, 0.45)],
      [0.2, MATERIAL.water],
      [1, mix(MATERIAL.water, getColor("BLACK"), 0.55)],
    ]
  );
  sketch.stroke(fade(getColor("WHITE"), 0.35));
  sketch.strokeWeight(1);
  for (let ripple = 0; ripple < 5; ripple += 1) {
    const x = ((ripple * 0.21 + time * 0.03) % 1) * place.damFoot;
    sketch.line(x, surface + 2, x + 18, surface + 2);
  }
  sketch.noStroke();
  withShadow(
    sketch,
    { blur: 20, color: fade(getColor("BLACK"), 0.55), drop: 6 },
    () => {
      sketch.fill(MATERIAL.concrete);
      sketch.quad(
        place.damFoot,
        place.bed,
        place.damFoot + 6,
        top,
        place.damFoot + 22,
        top,
        place.damBase,
        place.bed
      );
    }
  );
  sketch.fill(fade(getColor("BLACK"), 0.18));
  sketch.triangle(
    place.damFoot + 22,
    top,
    place.damBase,
    place.bed,
    place.damFoot + 14,
    place.bed
  );
  return surface;
}

/** The penstock from the intake to the turbine, with water parcels moving at the speed the head gives them. */
function paintPenstock(
  sketch: p5,
  place: ReturnType<typeof layout>,
  head: number,
  time: number
) {
  const intake = { x: place.damFoot + 4, y: place.bed - 14 * place.metre };
  const turbine = {
    x: place.house.x + sketch.width * 0.04,
    y: place.bed - sketch.height * 0.05,
  };
  const pipe = Math.max(sketch.height * 0.028, 7);
  sketch.stroke(mix(MATERIAL.galvanizedSteel, getColor("SLATE", 700), 0.45));
  sketch.strokeWeight(pipe);
  sketch.line(intake.x, intake.y, turbine.x, turbine.y);
  sketch.stroke(fade(mix(MATERIAL.water, MATERIAL.waterGlint, 0.45), 0.9));
  sketch.strokeWeight(pipe * 0.45);
  sketch.line(intake.x, intake.y, turbine.x, turbine.y);
  sketch.noStroke();
  const pace = inletSpeed(head) / inletSpeed(HEAD.max);
  sketch.fill(fade(getColor("WHITE"), 0.85));
  for (let parcel = 0; parcel < 6; parcel += 1) {
    const along = (parcel / 6 + time * 0.55 * pace) % 1;
    sketch.circle(
      intake.x + (turbine.x - intake.x) * along,
      intake.y + (turbine.y - intake.y) * along,
      pipe * 0.4
    );
  }
  return turbine;
}

/** The powerhouse at the dam's foot: its spinning turbine, the generator and the river leaving below. */
function paintPowerhouse(
  sketch: p5,
  place: ReturnType<typeof layout>,
  turbine: { x: number; y: number },
  turn: number,
  time: number
) {
  const { height, width } = sketch;
  gradientRect(
    sketch,
    {
      height: height * 0.03,
      width: width - place.damBase,
      x: place.damBase,
      y: place.bed - height * 0.015,
    },
    [
      [0, mix(MATERIAL.water, MATERIAL.waterGlint, 0.45)],
      [1, MATERIAL.water],
    ]
  );
  sketch.stroke(fade(getColor("WHITE"), 0.5));
  sketch.strokeWeight(1);
  for (let wave = 0; wave < 7; wave += 1) {
    const x =
      place.damBase + ((wave / 7 + time * 0.08) % 1) * (width - place.damBase);
    sketch.line(x, place.bed - 2, x + 14, place.bed - 2);
  }
  sketch.noStroke();
  const box = {
    height: height * 0.14,
    width: width * 0.15,
    x: place.house.x - width * 0.02,
    y: place.house.y,
  };
  withShadow(
    sketch,
    { blur: 16, color: fade(getColor("BLACK"), 0.55), drop: 6 },
    () => {
      gradientRect(sketch, box, [
        [0, mix(MATERIAL.concrete, getColor("WHITE"), 0.35)],
        [1, mix(MATERIAL.concrete, getColor("BLACK"), 0.3)],
      ]);
    }
  );
  const radius = box.height * 0.32;
  sketch.fill(getColor("ZINC", 900));
  sketch.circle(turbine.x, turbine.y, radius * 2);
  sketch.stroke(STAGE_COLORS.shaft);
  sketch.strokeWeight(2.5);
  for (let blade = 0; blade < 6; blade += 1) {
    const angle = turn + (blade * Math.PI) / 3;
    sketch.line(
      turbine.x,
      turbine.y,
      turbine.x + Math.cos(angle) * radius * 0.85,
      turbine.y + Math.sin(angle) * radius * 0.85
    );
  }
  sketch.noStroke();
  sketch.fill(mix(STAGE_COLORS.electric, getColor("ZINC", 900), 0.35));
  sketch.rect(
    turbine.x - radius * 0.7,
    box.y + box.height * 0.08,
    radius * 1.4,
    radius * 0.9,
    3
  );
  const tower = { x: width * 0.84, y: place.bed - height * 0.42 };
  sketch.stroke(getColor("SLATE", 600));
  sketch.strokeWeight(2);
  sketch.line(tower.x - 14, place.bed, tower.x, tower.y);
  sketch.line(tower.x + 14, place.bed, tower.x, tower.y);
  sketch.line(tower.x - 20, tower.y + 14, tower.x + 20, tower.y + 14);
  sketch.stroke(fade(getColor("ZINC", 900), 0.7));
  sketch.strokeWeight(1.2);
  sketch.noFill();
  sketch.bezier(
    box.x + box.width,
    box.y + 4,
    tower.x - 60,
    tower.y + 30,
    tower.x - 40,
    tower.y + 20,
    tower.x - 20,
    tower.y + 14
  );
  sketch.line(tower.x + 20, tower.y + 14, width, tower.y + 28);
  sketch.noStroke();
}

/** Draws the valley: the reservoir at the chosen head, water racing down the penstock, and the energy chain. */
function damProgram(sketch: p5, read: () => DamFrame) {
  let time = 0;
  let turn = 0;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
    sketch.noStroke();
  };
  sketch.draw = () => {
    const { head } = read();
    const elapsed = sketch.isLooping()
      ? Math.min(sketch.deltaTime / 1000, 0.1)
      : 0;
    time += elapsed;
    turn += elapsed * 2.5 * (inletSpeed(head) / inletSpeed(HEAD.max)) * Math.PI;
    const place = layout(sketch);
    paintSky(sketch, place.bed);
    paintClouds(sketch, place.bed, time);
    paintHills(sketch, place.bed * 0.9);
    paintGround(sketch, place.bed, MATERIAL.grass);
    paintReservoir(sketch, place, head, time);
    const turbine = paintPenstock(sketch, place, head, time);
    paintPowerhouse(sketch, place, turbine, turn, time);
    vignette(sketch, 0.3);
  };
}

interface HydroDamLabProps {
  description: ReactNode;
  /** The head the dam holds first, in metres. */
  head?: number;
  labels: {
    electric: ReactNode;
    head: ReactNode;
    headControl: string;
    kinetic: ReactNode;
    potential: ReactNode;
    shaft: ReactNode;
    speed: ReactNode;
    viewLabel: string;
  };
  title: ReactNode;
}

/**
 * A hydropower dam in cross-section. Every second 10 m³ of water drops
 * through the head: its gravitational potential energy becomes kinetic
 * energy at the turbine, rotation of the shaft, then electricity. The bars
 * show each stage's power, and only the turbine and generator keep a share.
 */
export function HydroDamLab({
  description,
  head: initialHead = 50,
  labels,
  title,
}: HydroDamLabProps) {
  const [head, setHead] = useState(initialHead);
  const measure = useQuantity();
  const stages = stagePowers(head);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
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
          program={damProgram}
          state={{ head }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.head}
            value={<InlineMath math={measure(head, "\\text{ m}", 0)} />}
          />
          <VisualFactTabular
            label={labels.speed}
            value={
              <InlineMath math={measure(inletSpeed(head), "\\text{ m/s}", 1)} />
            }
          />
          <VisualFactIndicator
            indicatorColor={STAGE_COLORS.potential}
            label={labels.potential}
            value={
              <InlineMath
                math={measure(stages.potential / 1e6, "\\text{ MW}", 2)}
              />
            }
          />
          <VisualFactIndicator
            indicatorColor={STAGE_COLORS.kinetic}
            label={labels.kinetic}
            value={
              <InlineMath
                math={measure(stages.kinetic / 1e6, "\\text{ MW}", 2)}
              />
            }
          />
          <VisualFactIndicator
            indicatorColor={STAGE_COLORS.shaft}
            label={labels.shaft}
            value={
              <InlineMath
                math={measure(stages.shaft / 1e6, "\\text{ MW}", 2)}
              />
            }
          />
          <VisualFactIndicator
            indicatorColor={STAGE_COLORS.electric}
            label={labels.electric}
            value={
              <InlineMath
                math={measure(stages.electric / 1e6, "\\text{ MW}", 2)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
