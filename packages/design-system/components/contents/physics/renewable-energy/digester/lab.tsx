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
  cookingHours,
  DUNG,
  gasEnergy,
  gasVolume,
  methaneVolume,
} from "@repo/design-system/components/contents/physics/renewable-energy/digester/biogas";
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
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** The tones of the slurry, the brick dome and the stove flame. */
const SLURRY = MATERIAL.dungSlurry;
const BRICK = MATERIAL.brick;
const FLAME = MATERIAL.biogasFlame;

/** What the sketch reads on every frame: the dung fed each day. */
interface DigesterFrame {
  readonly dung: number;
}

/** The soil in cross-section under the yard, darker with depth. */
function paintSoil(sketch: p5, surface: number) {
  const { height, width } = sketch;
  gradientRect(sketch, { height: height - surface, width, x: 0, y: surface }, [
    [0, mix(MATERIAL.soil, getColor("WHITE"), 0.12)],
    [0.08, MATERIAL.soil],
    [1, mix(MATERIAL.soil, getColor("BLACK"), 0.6)],
  ]);
  sketch.fill(MATERIAL.grass);
  sketch.rect(0, surface - 4, width, 6);
}

/**
 * The buried dome: slurry in its lower part, gas gathering above it, and
 * bubbles rising through the slurry as fast as the microbes make gas.
 */
function paintDome(
  sketch: p5,
  centre: { x: number; y: number },
  size: number,
  share: number,
  time: number
) {
  withShadow(
    sketch,
    { blur: 18, color: fade(getColor("BLACK"), 0.6), drop: 4 },
    () => {
      sketch.fill(BRICK);
      sketch.arc(
        centre.x,
        centre.y,
        size * 2.12,
        size * 2.12,
        Math.PI,
        Math.PI * 2
      );
      sketch.rect(centre.x - size * 1.06, centre.y, size * 2.12, size * 0.5);
    }
  );
  sketch.fill(MATERIAL.gasWisp);
  sketch.arc(centre.x, centre.y, size * 2, size * 2, Math.PI, Math.PI * 2);
  sketch.rect(centre.x - size, centre.y, size * 2, size * 0.44);
  const level = centre.y - size * 0.25;
  gradientRect(
    sketch,
    {
      height: centre.y + size * 0.44 - level,
      width: size * 2,
      x: centre.x - size,
      y: level,
    },
    [
      [0, mix(SLURRY, getColor("WHITE"), 0.15)],
      [1, mix(SLURRY, getColor("BLACK"), 0.4)],
    ]
  );
  const bubbles = Math.round(6 + share * 30);
  sketch.fill(fade(getColor("WHITE"), 0.7));
  for (let bubble = 0; bubble < bubbles; bubble += 1) {
    const seed = Math.sin(bubble * 78.233) * 43_758.5453;
    const across = seed - Math.floor(seed);
    const rise = (time * (0.25 + across * 0.3) + across * 5) % 1;
    sketch.circle(
      centre.x - size * 0.9 + across * size * 1.8,
      centre.y + size * 0.4 - rise * (size * 0.65),
      2 + across * 3
    );
  }
  return { level, top: centre.y - size };
}

/** The pipes: dung in on the left, spent slurry out on the right, and gas up to the kitchen. */
function paintPipes(
  sketch: p5,
  surface: number,
  centre: { x: number; y: number },
  size: number,
  kitchen: { x: number; y: number }
) {
  sketch.stroke(getColor("SLATE", 400));
  sketch.strokeWeight(Math.max(size * 0.12, 6));
  sketch.line(
    centre.x - size * 1.7,
    surface - size * 0.2,
    centre.x - size * 0.8,
    centre.y + size * 0.3
  );
  sketch.line(
    centre.x + size * 0.8,
    centre.y + size * 0.3,
    centre.x + size * 1.7,
    surface - size * 0.1
  );
  sketch.strokeWeight(Math.max(size * 0.05, 3));
  sketch.stroke(getColor("ZINC", 900));
  sketch.noFill();
  sketch.beginShape();
  sketch.vertex(centre.x, centre.y - size);
  sketch.vertex(centre.x, surface - size * 0.3);
  sketch.vertex(kitchen.x, surface - size * 0.3);
  sketch.vertex(kitchen.x, kitchen.y);
  sketch.endShape();
  sketch.noStroke();
  sketch.fill(SLURRY);
  sketch.rect(
    centre.x - size * 2,
    surface - size * 0.5,
    size * 0.6,
    size * 0.5,
    3
  );
  sketch.rect(
    centre.x + size * 1.45,
    surface - size * 0.4,
    size * 0.6,
    size * 0.4,
    3
  );
}

/** The kitchen stove at the gas pipe's end, its flame as tall as the day's gas allows. */
function paintStove(
  sketch: p5,
  at: { x: number; y: number },
  size: number,
  share: number,
  time: number
) {
  withShadow(
    sketch,
    { blur: 10, color: fade(getColor("BLACK"), 0.5), drop: 4 },
    () => {
      gradientRect(
        sketch,
        {
          height: size * 0.5,
          width: size * 1.6,
          x: at.x - size * 0.8,
          y: at.y,
        },
        [
          [0, getColor("SLATE", 300)],
          [1, getColor("SLATE", 600)],
        ]
      );
    }
  );
  const tall = size * (0.3 + share * 0.9);
  spotlight(sketch, { x: at.x, y: at.y - tall * 0.5 }, tall * 2.2, {
    color: FLAME,
    strength: 0.45,
  });
  for (let tongue = -2; tongue <= 2; tongue += 1) {
    const flicker = 1 + Math.sin(time * 14 + tongue * 1.7) * 0.12;
    sketch.fill(fade(FLAME, 0.85));
    sketch.ellipse(
      at.x + tongue * size * 0.18,
      at.y - tall * 0.45 * flicker,
      size * 0.16,
      tall * flicker
    );
    sketch.fill(fade(mix(FLAME, getColor("WHITE"), 0.6), 0.9));
    sketch.ellipse(
      at.x + tongue * size * 0.18,
      at.y - tall * 0.25 * flicker,
      size * 0.08,
      tall * 0.45 * flicker
    );
  }
}

/** Draws the yard in cross-section: the fed digester bubbling below ground and the stove it lights. */
function digesterProgram(sketch: p5, read: () => DigesterFrame) {
  let time = 0;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
    sketch.noStroke();
  };
  sketch.draw = () => {
    const { dung } = read();
    time += sketch.isLooping() ? Math.min(sketch.deltaTime / 1000, 0.1) : 0;
    const { height, width } = sketch;
    const surface = height * 0.4;
    const share = (dung - DUNG.min) / (DUNG.max - DUNG.min);
    paintSky(sketch, surface);
    paintHills(sketch, surface);
    paintSoil(sketch, surface);
    const size = Math.min(width * 0.17, height * 0.28);
    const centre = { x: width * 0.38, y: surface + size * 1.25 };
    const kitchen = { x: width * 0.82, y: surface - height * 0.12 };
    withShadow(
      sketch,
      { blur: 12, color: fade(getColor("BLACK"), 0.4), drop: 5 },
      () => {
        gradientRect(
          sketch,
          {
            height: height * 0.26,
            width: width * 0.22,
            x: kitchen.x - width * 0.11,
            y: surface - height * 0.26,
          },
          [
            [0, MATERIAL.wallPlaster],
            [1, mix(MATERIAL.wallPlaster, getColor("BLACK"), 0.15)],
          ]
        );
      }
    );
    paintPipes(sketch, surface, centre, size, kitchen);
    paintDome(sketch, centre, size, share, time);
    paintStove(sketch, kitchen, Math.max(width * 0.06, 26), share, time);
    vignette(sketch, 0.3);
  };
}

interface BiogasDigesterLabProps {
  description: ReactNode;
  /** The dung fed each day at first, in kilograms. */
  dung?: number;
  labels: {
    cooking: ReactNode;
    dungControl: string;
    energy: ReactNode;
    gas: ReactNode;
    methane: ReactNode;
    viewLabel: string;
  };
  title: ReactNode;
}

/**
 * A household biogas digester in cross-section. Dung goes in, microbes break
 * it down without oxygen, and the biogas collecting under the dome runs to a
 * kitchen stove. More dung each day means more gas, more chemical energy and
 * longer cooking.
 */
export function BiogasDigesterLab({
  description,
  dung: initialDung = 25,
  labels,
  title,
}: BiogasDigesterLabProps) {
  const [dung, setDung] = useState(initialDung);
  const measure = useQuantity();

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <LabSlider
          label={labels.dungControl}
          max={DUNG.max}
          min={DUNG.min}
          name={labels.dungControl}
          onValueChange={setDung}
          readout={<InlineMath math={measure(dung, "\\text{ kg}", 0)} />}
          step={DUNG.step}
          value={dung}
        />
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={digesterProgram}
          state={{ dung }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.gas}
            value={
              <InlineMath math={measure(gasVolume(dung), "\\text{ m}^3", 1)} />
            }
          />
          <VisualFactTabular
            label={labels.methane}
            value={
              <InlineMath
                math={measure(methaneVolume(dung), "\\text{ m}^3", 2)}
              />
            }
          />
          <VisualFactTabular
            label={labels.energy}
            value={
              <InlineMath
                math={measure(gasEnergy(dung) / 1e6, "\\text{ MJ}", 1)}
              />
            }
          />
          <VisualFactTabular
            label={labels.cooking}
            value={
              <InlineMath math={measure(cookingHours(dung), "\\text{ h}", 1)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
