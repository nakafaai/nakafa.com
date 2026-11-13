import {
  fade,
  gradientRect,
  mix,
  vignette,
  withShadow,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import {
  paintClouds,
  paintSky,
  paintSun,
} from "@repo/design-system/components/contents/physics/renewable-energy/scenery/outdoor";
import {
  SEA_STATES,
  type Sea,
  SeaSchema,
  surfaceHeight,
  wavelength,
  wavePower,
} from "@repo/design-system/components/contents/physics/renewable-energy/wave/swell";
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

/** How much sea the view spans, in metres. */
const VIEW_METRES = 320;

/** How many times taller than true the waves are drawn, so a 1 m wave can be seen across 320 m. */
const HEIGHT_STRETCH = 4;

/** Where the buoy floats, in metres from the left edge. */
const BUOY_AT = 170;

/** What the sketch reads on every frame: the sea state. */
const WaveFrameSchema = Schema.Struct({ sea: SeaSchema });
type WaveFrame = typeof WaveFrameSchema.Type;

/** The sea's surface across the view at `time`, as canvas points. */
function surface(sketch: p5, sea: Sea, time: number, still: number) {
  const metre = sketch.width / VIEW_METRES;
  return Arr.makeBy(Math.ceil(sketch.width / 6) + 2, (index) => {
    const x = index * 6;
    return {
      x,
      y: still - surfaceHeight(sea, x / metre, time) * metre * HEIGHT_STRETCH,
    };
  });
}

/** The water body under the surface, lit at the crests and darker in the deep. */
function paintSea(
  sketch: p5,
  points: readonly { x: number; y: number }[],
  still: number
) {
  const { height, width } = sketch;
  const drawing = sketch.drawingContext;
  if (drawing instanceof CanvasRenderingContext2D) {
    drawing.save();
    drawing.beginPath();
    drawing.moveTo(0, height);
    for (const point of points) {
      drawing.lineTo(point.x, point.y);
    }
    drawing.lineTo(width, height);
    drawing.closePath();
    drawing.clip();
    gradientRect(
      sketch,
      { height: height - still * 0.8, width, x: 0, y: still * 0.8 },
      [
        [0, mix(MATERIAL.water, MATERIAL.waterGlint, 0.45)],
        [0.25, MATERIAL.water],
        [1, mix(MATERIAL.water, getColor("BLACK"), 0.65)],
      ]
    );
    drawing.restore();
  }
  sketch.noFill();
  sketch.stroke(fade(getColor("WHITE"), 0.6));
  sketch.strokeWeight(2);
  sketch.beginShape();
  for (const point of points) {
    sketch.vertex(point.x, point.y);
  }
  sketch.endShape();
  sketch.noStroke();
}

/** The buoy riding the surface, its tether running down to the generator on the seabed. */
function paintBuoy(sketch: p5, sea: Sea, time: number, still: number) {
  const metre = sketch.width / VIEW_METRES;
  const x = BUOY_AT * metre;
  const y = still - surfaceHeight(sea, BUOY_AT, time) * metre * HEIGHT_STRETCH;
  const bed = sketch.height * 0.94;
  const size = Math.max(sketch.width * 0.05, 20);
  sketch.stroke(fade(getColor("ZINC", 900), 0.8));
  sketch.strokeWeight(2);
  sketch.line(x, y, x, bed - size * 0.5);
  sketch.noStroke();
  sketch.fill(getColor("SLATE", 600));
  sketch.rect(x - size * 0.6, bed - size * 0.5, size * 1.2, size * 0.5, 4);
  sketch.fill(PLOT_COLORS.orange);
  for (let spark = 0; spark < 4; spark += 1) {
    const along = (spark / 4 + time * 0.25) % 1;
    sketch.circle(
      x + size * 0.6 + along * (sketch.width - x - size * 0.6),
      bed - size * 0.2,
      4
    );
  }
  withShadow(
    sketch,
    { blur: 12, color: fade(getColor("BLACK"), 0.5), drop: 4 },
    () => {
      gradientRect(
        sketch,
        {
          height: size * 0.55,
          width: size * 1.4,
          x: x - size * 0.7,
          y: y - size * 0.3,
        },
        [
          [0, mix(MATERIAL.buoyPaint, getColor("WHITE"), 0.3)],
          [1, mix(MATERIAL.buoyPaint, getColor("BLACK"), 0.35)],
        ]
      );
    }
  );
  sketch.fill(getColor("SLATE", 300));
  sketch.rect(x - 2, y - size * 0.95, 4, size * 0.65);
  sketch.fill(MATERIAL.windowGlow);
  sketch.circle(x, y - size * 0.95, 7);
}

/** Draws the open sea in cross-section: the waves rolling past and the buoy heaving on them. */
function waveProgram(sketch: p5, read: () => WaveFrame) {
  let time = 0;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
    sketch.noStroke();
  };
  sketch.draw = () => {
    const { sea } = read();
    time += sketch.isLooping() ? Math.min(sketch.deltaTime / 1000, 0.1) : 0;
    const { height, width } = sketch;
    const still = height * 0.45;
    paintSky(sketch, still);
    paintSun(
      sketch,
      { x: width * 0.82, y: height * 0.1 },
      Math.max(height * 0.035, 9),
      0.8
    );
    paintClouds(sketch, still, time);
    const points = surface(sketch, sea, time, still);
    paintSea(sketch, points, still);
    paintBuoy(sketch, sea, time, still);
    const metre = width / VIEW_METRES;
    sketch.stroke(fade(getColor("WHITE"), 0.55));
    sketch.strokeWeight(1);
    const crest = still - (SEA_STATES[sea].height / 2) * metre * HEIGHT_STRETCH;
    sketch.line(
      width * 0.04,
      crest,
      width * 0.04,
      crest + SEA_STATES[sea].height * metre * HEIGHT_STRETCH
    );
    sketch.line(width * 0.04 - 5, crest, width * 0.04 + 5, crest);
    sketch.line(
      width * 0.04 - 5,
      crest + SEA_STATES[sea].height * metre * HEIGHT_STRETCH,
      width * 0.04 + 5,
      crest + SEA_STATES[sea].height * metre * HEIGHT_STRETCH
    );
    sketch.noStroke();
    vignette(sketch, 0.3);
  };
}

interface WaveBuoyPowerLabProps {
  description: ReactNode;
  labels: {
    chooseSea: string;
    height: ReactNode;
    length: ReactNode;
    period: ReactNode;
    power: ReactNode;
    seas: Record<Sea, ReactNode>;
    viewLabel: string;
  };
  /** The sea state first shown. */
  sea?: Sea;
  title: ReactNode;
}

/**
 * A wave-energy buoy riding deep-water waves, drawn in cross-section with the
 * height stretched four times. Each sea carries ρ g² H² T / (64π) watts
 * across every metre of crest: twice the wave height brings four times the
 * power, and the buoy's generator on the seabed turns part of it into
 * electricity.
 */
export function WaveBuoyPowerLab({
  description,
  labels,
  sea: initialSea = "moderate",
  title,
}: WaveBuoyPowerLabProps) {
  const [sea, setSea] = useState<Sea>(initialSea);
  const measure = useQuantity();
  const isSea = Schema.is(SeaSchema);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseSea}
          gridColumns="3"
          onValueChange={(value) => {
            if (isSea(value)) {
              setSea(value);
            }
          }}
          type="single"
          value={sea}
          variant="outline"
        >
          {Arr.map(SeaSchema.literals, (option) => (
            <ToggleGroupItem key={option} value={option}>
              {labels.seas[option]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={waveProgram}
          state={{ sea }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.height}
            value={
              <InlineMath
                math={measure(SEA_STATES[sea].height, "\\text{ m}", 0)}
              />
            }
          />
          <VisualFactTabular
            label={labels.period}
            value={
              <InlineMath
                math={measure(SEA_STATES[sea].period, "\\text{ s}", 0)}
              />
            }
          />
          <VisualFactTabular
            label={labels.length}
            value={
              <InlineMath math={measure(wavelength(sea), "\\text{ m}", 0)} />
            }
          />
          <VisualFactTabular
            label={labels.power}
            value={
              <InlineMath
                math={measure(wavePower(sea) / 1000, "\\text{ kW/m}", 1)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
