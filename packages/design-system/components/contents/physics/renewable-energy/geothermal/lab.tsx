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
  electricPower,
  heatRate,
  idealEfficiency,
  plantEfficiency,
  RESERVOIR,
} from "@repo/design-system/components/contents/physics/renewable-energy/geothermal/loop";
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
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** The colors of the hot rising water, the cooled returning water and the reservoir's glow. */
const HOT = mix(PLOT_COLORS.orange, PLOT_COLORS.pink, 0.3);
const COOL = mix(PLOT_COLORS.teal, getColor("SLATE", 300), 0.3);

/** What the sketch reads on every frame: the reservoir's temperature, in degrees Celsius. */
interface GeothermalFrame {
  readonly reservoir: number;
}

/** The ground in cross-section: soil, the cap rock, and the hot reservoir glowing below. */
function paintStrata(sketch: p5, surface: number, reservoir: number) {
  const { height, width } = sketch;
  const warmth = (reservoir - RESERVOIR.min) / (RESERVOIR.max - RESERVOIR.min);
  gradientRect(sketch, { height: height - surface, width, x: 0, y: surface }, [
    [0, SCENERY.soil],
    [0.35, SCENERY.rock],
    [0.62, mix(SCENERY.rock, getColor("BLACK"), 0.35)],
    [1, mix(SCENERY.rock, HOT, 0.25 + warmth * 0.35)],
  ]);
  sketch.fill(SCENERY.grass);
  sketch.rect(0, surface - 3, width, 5);
  spotlight(
    sketch,
    { x: width * 0.5, y: height * 0.95 },
    width * (0.35 + warmth * 0.2),
    { color: HOT, strength: 0.35 + warmth * 0.45 }
  );
}

/** The two wells and the water moving in them: hot up the production well, cooled down the injection well. */
function paintWells(
  sketch: p5,
  surface: number,
  wells: { hot: number; cool: number },
  time: number
) {
  const { height } = sketch;
  const bottom = height * 0.9;
  const bore = Math.max(sketch.width * 0.014, 6);
  for (const [x, color, rising] of [
    [wells.hot, HOT, true],
    [wells.cool, COOL, false],
  ] as const) {
    sketch.fill(getColor("SLATE", 600));
    sketch.rect(x - bore, surface, bore * 2, bottom - surface);
    sketch.fill(color);
    sketch.rect(x - bore * 0.55, surface, bore * 1.1, bottom - surface);
    sketch.fill(fade(getColor("WHITE"), 0.75));
    for (let parcel = 0; parcel < 7; parcel += 1) {
      const along = (parcel / 7 + time * 0.18) % 1;
      const y = rising
        ? bottom - along * (bottom - surface)
        : surface + along * (bottom - surface);
      sketch.circle(x, y, bore * 0.6);
    }
  }
}

/** The plant on the surface: its hall, its cooling fans and the plume of warm air above them. */
function paintPlant(
  sketch: p5,
  surface: number,
  wells: { hot: number; cool: number },
  time: number,
  share: number
) {
  const { height, width } = sketch;
  const hall = {
    height: height * 0.14,
    width: wells.cool - wells.hot + width * 0.08,
    x: wells.hot - width * 0.04,
    y: surface - height * 0.14,
  };
  withShadow(
    sketch,
    { blur: 14, color: fade(getColor("BLACK"), 0.5), drop: 6 },
    () => {
      gradientRect(sketch, hall, [
        [0, mix(SCENERY.concrete, getColor("WHITE"), 0.4)],
        [1, mix(SCENERY.concrete, getColor("BLACK"), 0.2)],
      ]);
    }
  );
  const fans = { x: wells.cool + width * 0.08, y: surface - height * 0.1 };
  sketch.fill(getColor("SLATE", 400));
  sketch.rect(fans.x, fans.y, width * 0.16, height * 0.1, 3);
  for (let puff = 0; puff < 5; puff += 1) {
    const rise = (time * 0.2 + puff / 5) % 1;
    sketch.fill(fade(getColor("WHITE"), 0.35 * (1 - rise)));
    sketch.circle(
      fans.x + width * 0.08 + Math.sin(puff + time) * 6,
      fans.y - rise * height * 0.22,
      16 + rise * 28
    );
  }
  const tower = { x: width * 0.9, y: surface - height * 0.3 };
  sketch.stroke(getColor("SLATE", 600));
  sketch.strokeWeight(2);
  sketch.line(tower.x - 12, surface, tower.x, tower.y);
  sketch.line(tower.x + 12, surface, tower.x, tower.y);
  sketch.stroke(fade(getColor("ZINC", 900), 0.7));
  sketch.strokeWeight(1);
  sketch.line(hall.x + hall.width, hall.y + 6, tower.x, tower.y + 8);
  sketch.noStroke();
  sketch.fill(PLOT_COLORS.orange);
  const sparks = 2 + Math.round(share * 6);
  for (let spark = 0; spark < sparks; spark += 1) {
    const along = (spark / sparks + time * 0.3) % 1;
    sketch.circle(
      hall.x + hall.width + (tower.x - hall.x - hall.width) * along,
      hall.y + 6 + (tower.y + 2 - hall.y) * along,
      4
    );
  }
}

/** Draws the geothermal field in cross-section at the chosen reservoir temperature. */
function geothermalProgram(sketch: p5, read: () => GeothermalFrame) {
  let time = 0;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
    sketch.noStroke();
  };
  sketch.draw = () => {
    const { reservoir } = read();
    time += sketch.isLooping() ? Math.min(sketch.deltaTime / 1000, 0.1) : 0;
    const { height, width } = sketch;
    const surface = height * 0.36;
    const share = electricPower(reservoir) / electricPower(RESERVOIR.max);
    paintSky(sketch, surface);
    paintHills(sketch, surface);
    paintStrata(sketch, surface, reservoir);
    const wells = { cool: width * 0.46, hot: width * 0.24 };
    paintWells(sketch, surface, wells, time);
    paintPlant(sketch, surface, wells, time, share);
    vignette(sketch, 0.3);
  };
}

interface GeothermalLoopLabProps {
  description: ReactNode;
  labels: {
    electric: ReactNode;
    heat: ReactNode;
    ideal: ReactNode;
    real: ReactNode;
    reservoirControl: string;
    viewLabel: string;
  };
  /** The reservoir's temperature at first, in degrees Celsius. */
  reservoir?: number;
  title: ReactNode;
}

/**
 * A geothermal plant in cross-section: hot water rises up the production
 * well, gives its heat to the plant, and goes back down the injection well at
 * 70 °C. A hotter reservoir gives more heat each second and lets the heat
 * engine convert a larger share of it, so the electricity climbs steeply.
 */
export function GeothermalLoopLab({
  description,
  labels,
  reservoir: initialReservoir = 200,
  title,
}: GeothermalLoopLabProps) {
  const [reservoir, setReservoir] = useState(initialReservoir);
  const measure = useQuantity();

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <LabSlider
          label={labels.reservoirControl}
          max={RESERVOIR.max}
          min={RESERVOIR.min}
          name={labels.reservoirControl}
          onValueChange={setReservoir}
          readout={
            <InlineMath math={measure(reservoir, "^\\circ\\text{C}", 0)} />
          }
          step={RESERVOIR.step}
          value={reservoir}
        />
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={geothermalProgram}
          state={{ reservoir }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.heat}
            value={
              <InlineMath
                math={measure(heatRate(reservoir) / 1e6, "\\text{ MW}", 1)}
              />
            }
          />
          <VisualFactTabular
            label={labels.ideal}
            value={
              <InlineMath
                math={measure(idealEfficiency(reservoir) * 100, "\\%", 1)}
              />
            }
          />
          <VisualFactTabular
            label={labels.real}
            value={
              <InlineMath
                math={measure(plantEfficiency(reservoir) * 100, "\\%", 1)}
              />
            }
          />
          <VisualFactTabular
            label={labels.electric}
            value={
              <InlineMath
                math={measure(electricPower(reservoir) / 1e6, "\\text{ MW}", 1)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
