import {
  arrow,
  fade,
  gradientRect,
  mix,
  spotlight,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import {
  ABSORBED_SUNLIGHT,
  ABSORPTANCE,
  BARE_TEMPERATURE,
  backRadiation,
  surfaceEmission,
  surfaceTemperature,
} from "@repo/design-system/components/contents/physics/renewable-energy/greenhouse/layer";
import { SCENERY } from "@repo/design-system/components/contents/physics/renewable-energy/scenery/outdoor";
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

/** The colors of sunlight and of infrared, shared by the arrows and the facts. */
const SUNLIGHT = PLOT_COLORS.amber;
const INFRARED = PLOT_COLORS.pink;

/** The widest flux the arrows draw, in watts per square metre. */
const WIDEST = surfaceEmission(ABSORPTANCE.max);

/** What the sketch reads on every frame: the share of infrared the layer absorbs. */
interface GreenhouseFrame {
  readonly absorptance: number;
}

/** A wavy column of infrared from one height to another, as wide as its flux. */
function paintInfrared(
  sketch: p5,
  x: number,
  from: number,
  to: number,
  flux: number,
  time: number
) {
  const weight = Math.max(1.5, (flux / WIDEST) * sketch.width * 0.05);
  const rising = to < from;
  sketch.noFill();
  sketch.stroke(fade(INFRARED, 0.85));
  sketch.strokeWeight(weight);
  sketch.beginShape();
  for (let step = 0; step <= 24; step += 1) {
    const share = step / 24;
    const y = from + (to - from) * share;
    sketch.vertex(
      x + Math.sin(share * 14 + (rising ? -1 : 1) * time * 6) * weight * 0.8,
      y
    );
  }
  sketch.endShape();
  sketch.noStroke();
  sketch.fill(fade(INFRARED, 0.9));
  const head = Math.max(weight * 1.6, 8);
  const tip = rising ? to - head * 0.4 : to + head * 0.4;
  sketch.triangle(
    x,
    tip,
    x - head * 0.7,
    rising ? to + head * 0.6 : to - head * 0.6,
    x + head * 0.7,
    rising ? to + head * 0.6 : to - head * 0.6
  );
}

/** Draws the planet's surface under its layer of atmosphere, with the fluxes of sunlight and infrared. */
function greenhouseProgram(sketch: p5, read: () => GreenhouseFrame) {
  let time = 0;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
    sketch.noStroke();
  };
  sketch.draw = () => {
    const { absorptance } = read();
    time += sketch.isLooping() ? Math.min(sketch.deltaTime / 1000, 0.1) : 0;
    const { height, width } = sketch;
    const ground = height * 0.82;
    const layer = { bottom: height * 0.46, top: height * 0.3 };
    gradientRect(sketch, { height: ground, width, x: 0, y: 0 }, [
      [0, getColor("ZINC", 950)],
      [0.5, mix(getColor("ZINC", 950), getColor("SLATE", 800), 0.7)],
      [1, mix(getColor("SLATE", 800), SCENERY.skyDay, 0.5)],
    ]);
    gradientRect(
      sketch,
      { height: layer.bottom - layer.top, width, x: 0, y: layer.top },
      [
        [0, fade(mix(PLOT_COLORS.violet, getColor("SLATE", 300), 0.5), 0)],
        [
          0.5,
          fade(
            mix(PLOT_COLORS.violet, getColor("SLATE", 300), 0.5),
            0.15 + absorptance * 0.6
          ),
        ],
        [1, fade(mix(PLOT_COLORS.violet, getColor("SLATE", 300), 0.5), 0)],
      ]
    );
    const warmth = Math.min(
      Math.max((surfaceTemperature(absorptance) - BARE_TEMPERATURE) / 55, 0),
      1
    );
    sketch.fill(mix(SCENERY.grass, PLOT_COLORS.orange, warmth * 0.55));
    sketch.ellipse(width / 2, ground + width * 1.6, width * 4, width * 3.2);
    spotlight(
      sketch,
      { x: width * 0.5, y: ground + height * 0.05 },
      width * 0.5,
      { color: PLOT_COLORS.orange, strength: warmth * 0.45 }
    );
    const sunWidth = Math.max(2, (ABSORBED_SUNLIGHT / WIDEST) * width * 0.05);
    arrow(
      sketch,
      { x: width * 0.1, y: 0 },
      { x: width * 0.24, y: ground - 4 },
      { color: fade(SUNLIGHT, 0.9), head: sunWidth * 1.8, weight: sunWidth }
    );
    const emitted = surfaceEmission(absorptance);
    const back = backRadiation(absorptance);
    paintInfrared(
      sketch,
      width * 0.46,
      ground - 6,
      layer.bottom,
      emitted,
      time
    );
    paintInfrared(
      sketch,
      width * 0.46,
      layer.top,
      height * 0.04,
      (1 - absorptance) * emitted,
      time
    );
    paintInfrared(sketch, width * 0.66, layer.top, height * 0.04, back, time);
    paintInfrared(sketch, width * 0.8, layer.bottom, ground - 8, back, time);
    vignette(sketch, 0.35);
  };
}

interface GreenhouseLayerLabProps {
  /** The share of infrared the layer absorbs at first. */
  absorptance?: number;
  description: ReactNode;
  labels: {
    absorptanceControl: string;
    back: ReactNode;
    celsius: ReactNode;
    emitted: ReactNode;
    kelvin: ReactNode;
    sunlight: ReactNode;
    viewLabel: string;
  };
  title: ReactNode;
}

/**
 * Earth's surface under one layer of atmosphere. Sunlight passes through and
 * warms the ground, the ground gives off infrared, and the layer absorbs a
 * share of it and sends half of that back down. Raise the share and the
 * surface must warm until it sheds the sunlight plus the back radiation.
 */
export function GreenhouseLayerLab({
  absorptance: initialAbsorptance = 0.78,
  description,
  labels,
  title,
}: GreenhouseLayerLabProps) {
  const [absorptance, setAbsorptance] = useState(initialAbsorptance);
  const measure = useQuantity();
  const kelvin = surfaceTemperature(absorptance);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <LabSlider
          label={labels.absorptanceControl}
          max={ABSORPTANCE.max}
          min={ABSORPTANCE.min}
          name={labels.absorptanceControl}
          onValueChange={setAbsorptance}
          readout={<InlineMath math={measure(absorptance * 100, "\\%", 0)} />}
          step={ABSORPTANCE.step}
          value={absorptance}
        />
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={greenhouseProgram}
          state={{ absorptance }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactIndicator
            indicatorColor={SUNLIGHT}
            label={labels.sunlight}
            value={
              <InlineMath
                math={measure(ABSORBED_SUNLIGHT, "\\text{ W/m}^2", 0)}
              />
            }
          />
          <VisualFactIndicator
            indicatorColor={INFRARED}
            label={labels.emitted}
            value={
              <InlineMath
                math={measure(
                  surfaceEmission(absorptance),
                  "\\text{ W/m}^2",
                  0
                )}
              />
            }
          />
          <VisualFactIndicator
            indicatorColor={INFRARED}
            label={labels.back}
            value={
              <InlineMath
                math={measure(backRadiation(absorptance), "\\text{ W/m}^2", 0)}
              />
            }
          />
          <VisualFactTabular
            label={labels.kelvin}
            value={<InlineMath math={measure(kelvin, "\\text{ K}", 0)} />}
          />
          <VisualFactTabular
            label={labels.celsius}
            value={
              <InlineMath
                math={measure(kelvin - 273.15, "^\\circ\\text{C}", 1)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
