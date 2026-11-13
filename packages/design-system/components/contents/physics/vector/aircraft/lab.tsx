import {
  arrow,
  dashed,
  fade,
  mix,
  outOfFocus,
  vignette,
  withShadow,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import {
  bearingVector,
  type Crosswind,
  CrosswindSchema,
  groundVelocity,
} from "@repo/design-system/components/contents/physics/vector/aircraft/drift";
import { paintFarmland } from "@repo/design-system/components/contents/physics/vector/aircraft/land";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
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
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useMemo, useState } from "react";

/** Pixels the land slides per second for each km/h over the ground, so the motion reads without racing. */
const LAND_RATE = 0.06;

/** What the sketch reads on every frame. */
interface CrosswindFrame {
  readonly flight: Crosswind;
  readonly heading: number;
}

/** The size of the land tile that repeats under the plane, in pixels. */
const TILE = 640;

/** The airliner from above, nose up the canvas before it turns to its heading. */
function paintAirliner(sketch: p5, size: number) {
  const body = MATERIAL.deckWhite;
  const shade = mix(MATERIAL.deckWhite, MATERIAL.aluminium, 0.6);
  sketch.noStroke();
  sketch.fill(shade);
  sketch.beginShape();
  sketch.vertex(0, -size * 0.08);
  sketch.vertex(size * 0.5, size * 0.12);
  sketch.vertex(size * 0.5, size * 0.18);
  sketch.vertex(0, size * 0.08);
  sketch.vertex(-size * 0.5, size * 0.18);
  sketch.vertex(-size * 0.5, size * 0.12);
  sketch.endShape(sketch.CLOSE);
  sketch.beginShape();
  sketch.vertex(0, size * 0.36);
  sketch.vertex(size * 0.18, size * 0.46);
  sketch.vertex(size * 0.18, size * 0.5);
  sketch.vertex(-size * 0.18, size * 0.5);
  sketch.vertex(-size * 0.18, size * 0.46);
  sketch.endShape(sketch.CLOSE);
  sketch.fill(body);
  sketch.rect(
    -size * 0.055,
    -size * 0.5,
    size * 0.11,
    size * 0.98,
    size * 0.055
  );
  sketch.fill(MATERIAL.aluminium);
  sketch.rect(-size * 0.2, size * 0.02, size * 0.05, size * 0.12, size * 0.02);
  sketch.rect(size * 0.15, size * 0.02, size * 0.05, size * 0.12, size * 0.02);
  sketch.fill(MATERIAL.tintedGlass);
  sketch.rect(
    -size * 0.03,
    -size * 0.47,
    size * 0.06,
    size * 0.04,
    size * 0.02
  );
}

/**
 * Draws the plane over the land: the land and the cloud shadows slide past
 * along the ground velocity, the plane points along its heading, and the
 * air velocity (teal) and the wind (amber) add tip to tail into the ground
 * velocity (violet), which runs along the dashed track.
 */
function crosswindProgram(sketch: p5, read: () => CrosswindFrame) {
  let land: p5.Graphics | undefined;
  let east = 0;
  let north = 0;
  let windEast = 0;
  let windNorth = 0;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const { flight, heading } = read();
    const ground = groundVelocity(flight, heading);
    const air = bearingVector(flight.airspeed, heading);
    const wind = bearingVector(flight.wind, flight.toward);
    if (!land) {
      land = sketch.createGraphics(TILE, TILE);
      paintFarmland(land);
    }
    if (sketch.isLooping()) {
      const step = Math.min(sketch.deltaTime / 1000, 0.1) * LAND_RATE;
      east = (east + ground.east * step) % TILE;
      north = (north + ground.north * step) % TILE;
      windEast = (windEast + (ground.east - wind.east) * step) % TILE;
      windNorth = (windNorth + (ground.north - wind.north) * step) % TILE;
    }
    const drawing = sketch.drawingContext;
    if (drawing instanceof CanvasRenderingContext2D) {
      const left = -(((east % TILE) + TILE) % TILE);
      const top = (((north % TILE) + TILE) % TILE) - TILE;
      for (let x = left; x < sketch.width; x += TILE) {
        for (let y = top; y < sketch.height; y += TILE) {
          drawing.drawImage(land.elt, x, y, TILE, TILE);
        }
      }
    }
    outOfFocus(sketch, 7, () => {
      sketch.noStroke();
      for (let index = 0; index < 5; index += 1) {
        const span = sketch.width + 260;
        const tall = sketch.height + 200;
        const x =
          ((((index * 197 - windEast * 1.4) % span) + span) % span) - 130;
        const y =
          ((((index * 131 + windNorth * 1.4) % tall) + tall) % tall) - 100;
        for (let puff = 0; puff < 7; puff += 1) {
          const dx = (hashUnit(index, puff) - 0.5) * 120;
          const dy = (hashUnit(puff, index + 9) - 0.5) * 60;
          const radius = 34 + hashUnit(index + puff, 4) * 34;
          sketch.fill(fade(getColor("BLACK"), 0.07));
          sketch.circle(x + dx + 34, y + dy + 46, radius * 2);
          sketch.fill(fade(MATERIAL.cloudTop, 0.32));
          sketch.circle(x + dx, y + dy, radius * 2);
        }
      }
    });
    const center = { x: sketch.width / 2, y: sketch.height / 2 };
    const scale =
      (Math.min(sketch.width, sketch.height) * 0.44) /
      Math.max(flight.airspeed, ground.speed, 1);
    const turn = (ground.track * Math.PI) / 180;
    const reach = Math.hypot(sketch.width, sketch.height);
    dashed(
      sketch,
      {
        x: center.x - Math.sin(turn) * reach,
        y: center.y + Math.cos(turn) * reach,
      },
      {
        x: center.x + Math.sin(turn) * reach,
        y: center.y - Math.cos(turn) * reach,
      },
      { color: fade(getColor("WHITE"), 0.6), dash: 9, weight: 2 }
    );
    const size = Math.min(sketch.width, sketch.height) * 0.22;
    withShadow(
      sketch,
      { blur: 18, color: fade(getColor("BLACK"), 0.45), drop: size * 0.18 },
      () => {
        sketch.push();
        sketch.translate(center.x, center.y);
        sketch.rotate((heading * Math.PI) / 180);
        paintAirliner(sketch, size);
        sketch.pop();
      }
    );
    const airTip = {
      x: center.x + air.east * scale,
      y: center.y - air.north * scale,
    };
    const head = Math.max(12, size * 0.1);
    arrow(sketch, center, airTip, { color: PLOT_COLORS.teal, head, weight: 4 });
    arrow(
      sketch,
      airTip,
      { x: airTip.x + wind.east * scale, y: airTip.y - wind.north * scale },
      { color: PLOT_COLORS.amber, head, weight: 4 }
    );
    arrow(
      sketch,
      center,
      { x: center.x + ground.east * scale, y: center.y - ground.north * scale },
      { color: PLOT_COLORS.violet, head, weight: 4.5 }
    );
    vignette(sketch, 0.35);
  };
}

interface AircraftCrosswindLabProps {
  /** The airspeed of the plane, in km/h. */
  airspeed: number;
  description: ReactNode;
  /** The heading the plane starts on, as a bearing in degrees. */
  heading?: number;
  labels: {
    between: ReactNode;
    drift: ReactNode;
    groundSpeed: ReactNode;
    heading: ReactNode;
    headingName: string;
    track: ReactNode;
    viewLabel: string;
  };
  title: ReactNode;
  /** The bearing the wind blows toward, in degrees. */
  toward: number;
  /** The wind speed, in km/h. */
  wind: number;
}

/**
 * An airliner over farmland in a crosswind, seen from above. The learner
 * turns its heading: the nose points one way, but the plane moves over the
 * ground along the sum of its air velocity and the wind, so it crabs along
 * a track that differs from its heading by the drift angle.
 */
export function AircraftCrosswindLab({
  airspeed,
  description,
  heading: initial = 0,
  labels,
  title,
  toward,
  wind,
}: AircraftCrosswindLabProps) {
  const [heading, setHeading] = useState(initial);
  const quantity = useQuantity();
  const flight = useMemo(
    () => Schema.decodeUnknownSync(CrosswindSchema)({ airspeed, toward, wind }),
    [airspeed, toward, wind]
  );
  const ground = groundVelocity(flight, heading);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <LabSlider
          label={labels.heading}
          max={359}
          min={0}
          name={labels.headingName}
          onValueChange={setHeading}
          readout={<InlineMath math={quantity(heading, "^\\circ", 0)} />}
          step={1}
          value={heading}
        />
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={crosswindProgram}
          state={{ flight, heading }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.groundSpeed}
            value={
              <InlineMath math={quantity(ground.speed, "\\text{ km/h}", 0)} />
            }
          />
          <VisualFactTabular
            label={labels.track}
            value={<InlineMath math={quantity(ground.track, "^\\circ", 1)} />}
          />
          <VisualFactTabular
            label={labels.drift}
            value={<InlineMath math={quantity(ground.drift, "^\\circ", 1)} />}
          />
          <VisualFactTabular
            label={labels.between}
            value={<InlineMath math={quantity(ground.between, "^\\circ", 0)} />}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
