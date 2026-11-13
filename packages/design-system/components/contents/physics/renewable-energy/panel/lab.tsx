import {
  arrow,
  fade,
  gradientRect,
  mix,
  vignette,
  withShadow,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import {
  cellEfficiency,
  cellTemperature,
  IRRADIANCE,
  panelBalance,
} from "@repo/design-system/components/contents/physics/renewable-energy/panel/balance";
import {
  paintClouds,
  paintHills,
  paintSky,
  paintSun,
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
import {
  VisualFactIndicator,
  VisualFactTabular,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { P5Sketch } from "@repo/design-system/components/visual/sketch";
import { getColor } from "@repo/design-system/lib/color";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** The color of each share of the sunlight, shared by the scene and the facts. */
const SHARE_COLORS = {
  electric: PLOT_COLORS.orange,
  heat: PLOT_COLORS.pink,
  input: PLOT_COLORS.amber,
  reflected: getColor("SLATE", 300),
} as const;

/** The widest a beam of 1600 W is drawn, as a share of the canvas height. */
const BEAM_SCALE = 0.1;

/** What the sketch reads on every frame: the sunlight on the panel. */
interface PanelFrame {
  readonly irradiance: number;
}

/** The roof the panel lies on, its tiles in light and shade. */
function paintRoof(sketch: p5, eave: number) {
  const { height, width } = sketch;
  const tile = mix(PLOT_COLORS.orange, getColor("STONE", 600), 0.55);
  sketch.fill(tile);
  sketch.quad(
    0,
    eave + height * 0.3,
    width * 0.1,
    eave - height * 0.1,
    width,
    eave - height * 0.3,
    width,
    height
  );
  sketch.stroke(fade(mix(tile, getColor("BLACK"), 0.5), 0.6));
  sketch.strokeWeight(1);
  for (let row = 0; row < 10; row += 1) {
    const y = eave - height * 0.1 + row * height * 0.06;
    sketch.line(
      width * 0.1 - row * width * 0.01,
      y,
      width,
      y - height * 0.2 + row * height * 0.006
    );
  }
  sketch.noStroke();
}

/** The panel's corners on the roof, front edge first. */
function panelCorners(sketch: p5) {
  const { height, width } = sketch;
  return {
    backLeft: { x: width * 0.34, y: height * 0.5 },
    backRight: { x: width * 0.72, y: height * 0.42 },
    frontLeft: { x: width * 0.28, y: height * 0.72 },
    frontRight: { x: width * 0.68, y: height * 0.62 },
  };
}

/** The panel: dark cells that warm toward pink as the sun heats them, under bright glass. */
function paintPanel(sketch: p5, warmth: number) {
  const corners = panelCorners(sketch);
  const cell = mix(
    mix(getColor("ZINC", 900), getColor("SLATE", 600), 0.4),
    PLOT_COLORS.pink,
    warmth * 0.18
  );
  withShadow(
    sketch,
    { blur: 18, color: fade(getColor("BLACK"), 0.6), drop: 8 },
    () => {
      sketch.fill(cell);
      sketch.quad(
        corners.frontLeft.x,
        corners.frontLeft.y,
        corners.backLeft.x,
        corners.backLeft.y,
        corners.backRight.x,
        corners.backRight.y,
        corners.frontRight.x,
        corners.frontRight.y
      );
    }
  );
  sketch.stroke(fade(getColor("SLATE", 300), 0.45));
  sketch.strokeWeight(1);
  for (let line = 1; line < 6; line += 1) {
    const share = line / 6;
    sketch.line(
      corners.frontLeft.x +
        (corners.frontRight.x - corners.frontLeft.x) * share,
      corners.frontLeft.y +
        (corners.frontRight.y - corners.frontLeft.y) * share,
      corners.backLeft.x + (corners.backRight.x - corners.backLeft.x) * share,
      corners.backLeft.y + (corners.backRight.y - corners.backLeft.y) * share
    );
  }
  for (let line = 1; line < 4; line += 1) {
    const share = line / 4;
    sketch.line(
      corners.frontLeft.x + (corners.backLeft.x - corners.frontLeft.x) * share,
      corners.frontLeft.y + (corners.backLeft.y - corners.frontLeft.y) * share,
      corners.frontRight.x +
        (corners.backRight.x - corners.frontRight.x) * share,
      corners.frontRight.y +
        (corners.backRight.y - corners.frontRight.y) * share
    );
  }
  sketch.stroke(getColor("SLATE", 300));
  sketch.strokeWeight(2);
  sketch.noFill();
  sketch.quad(
    corners.frontLeft.x,
    corners.frontLeft.y,
    corners.backLeft.x,
    corners.backLeft.y,
    corners.backRight.x,
    corners.backRight.y,
    corners.frontRight.x,
    corners.frontRight.y
  );
  sketch.noStroke();
}

/**
 * The flows of energy: sunlight in, a thin reflection off the glass, heat
 * shimmering up from the warm panel, and electricity running down the cable.
 */
function paintFlows(sketch: p5, irradiance: number, time: number) {
  const { height, width } = sketch;
  const balance = panelBalance(irradiance);
  const centre = { x: width * 0.5, y: height * 0.56 };
  const full = height * BEAM_SCALE;
  const widthOf = (power: number) => Math.max(2, (power / 1600) * full);
  arrow(
    sketch,
    { x: width * 0.16, y: height * 0.08 },
    { x: centre.x - 10, y: centre.y - 14 },
    {
      color: fade(SHARE_COLORS.input, 0.85),
      head: widthOf(balance.input) * 1.4,
      weight: widthOf(balance.input),
    }
  );
  arrow(
    sketch,
    { x: centre.x + 12, y: centre.y - 16 },
    { x: width * 0.82, y: height * 0.1 },
    {
      color: fade(SHARE_COLORS.reflected, 0.9),
      head: 10,
      weight: widthOf(balance.reflected),
    }
  );
  sketch.noFill();
  sketch.stroke(fade(SHARE_COLORS.heat, 0.75));
  sketch.strokeWeight(widthOf(balance.heat) / 4);
  for (let wisp = 0; wisp < 4; wisp += 1) {
    const x = width * (0.42 + wisp * 0.06);
    sketch.beginShape();
    for (let step = 0; step <= 10; step += 1) {
      const rise = step / 10;
      sketch.vertex(
        x + Math.sin(rise * 9 + time * 3 + wisp) * 6,
        centre.y - 20 - rise * height * 0.22
      );
    }
    sketch.endShape();
  }
  const cable = [
    { x: width * 0.68, y: height * 0.62 },
    { x: width * 0.86, y: height * 0.7 },
    { x: width * 0.86, y: height * 0.95 },
  ] as const;
  sketch.stroke(getColor("ZINC", 900));
  sketch.strokeWeight(4);
  sketch.line(cable[0].x, cable[0].y, cable[1].x, cable[1].y);
  sketch.line(cable[1].x, cable[1].y, cable[2].x, cable[2].y);
  sketch.noStroke();
  sketch.fill(SHARE_COLORS.electric);
  const dots = Math.max(2, Math.round((balance.electric / 273.6) * 7));
  for (let dot = 0; dot < dots; dot += 1) {
    const along = (dot / dots + time * 0.35) % 1;
    const first = along < 0.5;
    const share = first ? along * 2 : (along - 0.5) * 2;
    const from = first ? cable[0] : cable[1];
    const to = first ? cable[1] : cable[2];
    sketch.circle(
      from.x + (to.x - from.x) * share,
      from.y + (to.y - from.y) * share,
      6
    );
  }
}

/** Draws the roof in the sun at the chosen irradiance, the flows of energy around the panel. */
function panelProgram(sketch: p5, read: () => PanelFrame) {
  let time = 0;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
    sketch.noStroke();
  };
  sketch.draw = () => {
    const { irradiance } = read();
    time += sketch.isLooping() ? Math.min(sketch.deltaTime / 1000, 0.1) : 0;
    const { height, width } = sketch;
    const horizon = height * 0.55;
    const strength = irradiance / IRRADIANCE.max;
    paintSky(sketch, horizon);
    paintSun(
      sketch,
      { x: width * 0.12, y: height * 0.08 },
      Math.max(height * 0.04, 10),
      strength
    );
    paintClouds(sketch, horizon, time, 1 - strength * 0.7);
    paintHills(sketch, horizon);
    gradientRect(
      sketch,
      { height: height - horizon, width, x: 0, y: horizon },
      [
        [0, SCENERY.grass],
        [1, SCENERY.grassDark],
      ]
    );
    paintRoof(sketch, height * 0.62);
    const warmth =
      (cellTemperature(irradiance) - cellTemperature(IRRADIANCE.min)) /
      (cellTemperature(IRRADIANCE.max) - cellTemperature(IRRADIANCE.min));
    paintPanel(sketch, warmth);
    paintFlows(sketch, irradiance, time);
    vignette(sketch, 0.3);
  };
}

interface SolarPanelHeatLabProps {
  description: ReactNode;
  /** The sunlight on the panel at first, in watts per square metre. */
  irradiance?: number;
  labels: {
    efficiency: ReactNode;
    electric: ReactNode;
    heat: ReactNode;
    input: ReactNode;
    irradianceControl: string;
    reflected: ReactNode;
    temperature: ReactNode;
    viewLabel: string;
  };
  title: ReactNode;
}

/**
 * A 1.6 m² solar panel on a roof. The sunlight on it splits into a thin
 * reflection, electricity, and heat, and the three always add back to the
 * input. Stronger sun heats the cells, so the panel turns a slightly smaller
 * share into electricity.
 */
export function SolarPanelHeatLab({
  description,
  irradiance: initialIrradiance = 1000,
  labels,
  title,
}: SolarPanelHeatLabProps) {
  const [irradiance, setIrradiance] = useState(initialIrradiance);
  const measure = useQuantity();
  const balance = panelBalance(irradiance);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <LabSlider
          label={labels.irradianceControl}
          max={IRRADIANCE.max}
          min={IRRADIANCE.min}
          name={labels.irradianceControl}
          onValueChange={setIrradiance}
          readout={
            <InlineMath math={measure(irradiance, "\\text{ W/m}^2", 0)} />
          }
          step={IRRADIANCE.step}
          value={irradiance}
        />
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={panelProgram}
          state={{ irradiance }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactIndicator
            indicatorColor={SHARE_COLORS.input}
            label={labels.input}
            value={
              <InlineMath math={measure(balance.input, "\\text{ W}", 0)} />
            }
          />
          <VisualFactIndicator
            indicatorColor={SHARE_COLORS.electric}
            label={labels.electric}
            value={
              <InlineMath math={measure(balance.electric, "\\text{ W}", 0)} />
            }
          />
          <VisualFactIndicator
            indicatorColor={SHARE_COLORS.reflected}
            label={labels.reflected}
            value={
              <InlineMath math={measure(balance.reflected, "\\text{ W}", 0)} />
            }
          />
          <VisualFactIndicator
            indicatorColor={SHARE_COLORS.heat}
            label={labels.heat}
            value={<InlineMath math={measure(balance.heat, "\\text{ W}", 0)} />}
          />
          <VisualFactTabular
            label={labels.temperature}
            value={
              <InlineMath
                math={measure(
                  cellTemperature(irradiance),
                  "^\\circ\\text{C}",
                  1
                )}
              />
            }
          />
          <VisualFactTabular
            label={labels.efficiency}
            value={
              <InlineMath
                math={measure(cellEfficiency(irradiance) * 100, "\\%", 1)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
