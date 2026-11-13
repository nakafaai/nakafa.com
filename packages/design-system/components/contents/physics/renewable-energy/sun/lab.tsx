import {
  fade,
  mix,
  type PointSchema,
  vignette,
  withShadow,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import {
  paintGround,
  paintHills,
  paintSky,
  paintSun,
} from "@repo/design-system/components/contents/physics/renewable-energy/scenery/outdoor";
import {
  incidenceAngle,
  panelIrradiance,
  panelPower,
  SUN_HEIGHT,
  TILT,
} from "@repo/design-system/components/contents/physics/renewable-energy/sun/angle";
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

/** The color of the sun's rays. */
const RAY = MATERIAL.sunDisc;

/** How many rays the sketch draws on either side of the one through the panel's centre. */
const RAYS_EACH_SIDE = 9;

/** What the sketch reads on every frame: the sun's height and the panel's tilt, in degrees. */
const SunFrameSchema = Schema.Struct({
  sun: Schema.Finite,
  tilt: Schema.Finite,
});
type SunFrame = typeof SunFrameSchema.Type;

/** A point on the canvas, in pixels. */
type Point = typeof PointSchema.Type;

/**
 * Draws the parallel rays of the sun: those that land on the panel end there,
 * bright, the rest run on to the ground. The panel always catches a band of
 * rays as wide as its face looks from the sun, so a tilt toward the sun
 * catches more of them.
 */
function paintRays(
  sketch: p5,
  centre: Point,
  half: number,
  along: Point,
  sun: number,
  ground: number
) {
  const angle = (sun * Math.PI) / 180;
  const travel = { x: Math.cos(angle), y: Math.sin(angle) };
  const across = { x: -travel.y, y: travel.x };
  const spacing = (half * 2) / (RAYS_EACH_SIDE * 0.9);
  const far = sketch.width * 1.5;
  const det = -travel.x * along.y + along.x * travel.y;
  for (let ray = -RAYS_EACH_SIDE * 2; ray <= RAYS_EACH_SIDE * 2; ray += 1) {
    const origin = {
      x: centre.x + across.x * ray * spacing - travel.x * far,
      y: centre.y + across.y * ray * spacing - travel.y * far,
    };
    const gap = { x: centre.x - origin.x, y: centre.y - origin.y };
    const reach = (-gap.x * along.y + along.x * gap.y) / det;
    const where = (travel.x * gap.y - travel.y * gap.x) / det;
    const hits = Math.abs(where) <= half;
    const length = hits ? reach : (ground - origin.y) / travel.y;
    sketch.stroke(fade(RAY, hits ? 0.95 : 0.3));
    sketch.strokeWeight(hits ? 2 : 1.2);
    sketch.line(
      origin.x,
      origin.y,
      origin.x + travel.x * length,
      origin.y + travel.y * length
    );
  }
  sketch.noStroke();
}

/** The panel on its stand, tilted toward the sun, with its shadow on the ground. */
function paintPanel(
  sketch: p5,
  centre: Point,
  half: number,
  along: Point,
  ground: number
) {
  const left = { x: centre.x - along.x * half, y: centre.y - along.y * half };
  const right = { x: centre.x + along.x * half, y: centre.y + along.y * half };
  sketch.stroke(getColor("SLATE", 600));
  sketch.strokeWeight(4);
  sketch.line(centre.x, centre.y, centre.x, ground);
  sketch.line(centre.x - half * 0.35, ground, centre.x, centre.y + 10);
  sketch.line(centre.x + half * 0.35, ground, centre.x, centre.y + 10);
  sketch.noStroke();
  withShadow(
    sketch,
    { blur: 12, color: fade(getColor("BLACK"), 0.6), drop: 6 },
    () => {
      sketch.stroke(mix(getColor("ZINC", 900), getColor("SLATE", 600), 0.35));
      sketch.strokeWeight(Math.max(half * 0.08, 6));
      sketch.line(left.x, left.y, right.x, right.y);
    }
  );
  sketch.stroke(getColor("SLATE", 300));
  sketch.strokeWeight(1.5);
  sketch.line(
    left.x - along.y * 3,
    left.y + along.x * 3 - 3,
    right.x - along.y * 3,
    right.y + along.x * 3 - 3
  );
  sketch.noStroke();
}

/** Draws the field: the sun at its height, its rays, and the panel at its tilt. */
function sunProgram(sketch: p5, read: () => SunFrame) {
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
    sketch.noStroke();
    sketch.noLoop();
  };
  sketch.draw = () => {
    const { sun, tilt } = read();
    const { height, width } = sketch;
    const ground = height * 0.86;
    const centre = { x: width * 0.6, y: ground - height * 0.22 };
    const half = Math.min(height * 0.2, width * 0.16);
    const tiltAngle = (tilt * Math.PI) / 180;
    const along = { x: Math.cos(tiltAngle), y: -Math.sin(tiltAngle) };
    const sunAngle = (sun * Math.PI) / 180;
    const reach = Math.min(width * 0.5, height * 0.68);
    paintSky(sketch, ground);
    paintSun(
      sketch,
      {
        x: centre.x - Math.cos(sunAngle) * reach,
        y: centre.y - Math.sin(sunAngle) * reach,
      },
      Math.max(height * 0.035, 9)
    );
    paintHills(sketch, ground);
    paintGround(sketch, ground, MATERIAL.grass);
    paintRays(sketch, centre, half, along, sun, ground);
    paintPanel(sketch, centre, half, along, ground);
    vignette(sketch, 0.3);
  };
}

interface SolarPanelAngleLabProps {
  description: ReactNode;
  labels: {
    incidence: ReactNode;
    irradiance: ReactNode;
    power: ReactNode;
    sunControl: string;
    tiltControl: string;
    viewLabel: string;
  };
  /** The sun's height at first, in degrees. */
  sun?: number;
  /** The panel's tilt at first, in degrees. */
  tilt?: number;
  title: ReactNode;
}

/**
 * A solar panel on a stand under parallel rays of sunlight. Move the sun and
 * tilt the panel: it catches the most light when it faces the rays square
 * on, and each square metre collects 1000 cos θ watts, where θ is the angle
 * between the rays and the panel's normal.
 */
export function SolarPanelAngleLab({
  description,
  labels,
  sun: initialSun = 30,
  tilt: initialTilt = 0,
  title,
}: SolarPanelAngleLabProps) {
  const [sun, setSun] = useState(initialSun);
  const [tilt, setTilt] = useState(initialTilt);
  const measure = useQuantity();
  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <LabSlider
          label={labels.sunControl}
          max={SUN_HEIGHT.max}
          min={SUN_HEIGHT.min}
          name={labels.sunControl}
          onValueChange={setSun}
          readout={<InlineMath math={measure(sun, "^\\circ", 0)} />}
          step={SUN_HEIGHT.step}
          value={sun}
        />
        <LabSlider
          label={labels.tiltControl}
          max={TILT.max}
          min={TILT.min}
          name={labels.tiltControl}
          onValueChange={setTilt}
          readout={<InlineMath math={measure(tilt, "^\\circ", 0)} />}
          step={TILT.step}
          value={tilt}
        />
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={sunProgram}
          state={{ sun, tilt }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.incidence}
            value={
              <InlineMath
                math={measure(incidenceAngle(sun, tilt), "^\\circ", 0)}
              />
            }
          />
          <VisualFactTabular
            label={labels.irradiance}
            value={
              <InlineMath
                math={measure(panelIrradiance(sun, tilt), "\\text{ W/m}^2", 0)}
              />
            }
          />
          <VisualFactTabular
            label={labels.power}
            value={
              <InlineMath
                math={measure(panelPower(sun, tilt), "\\text{ W}", 0)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
