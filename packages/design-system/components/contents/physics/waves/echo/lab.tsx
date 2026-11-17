import { caption } from "@repo/design-system/components/contents/physics/canvas/caption";
import {
  fade,
  gradientRect,
  mix,
  vignette,
  withShadow,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { echo } from "@repo/design-system/components/contents/physics/waves/wave";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
} from "@repo/design-system/components/visual/card";
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { P5Sketch } from "@repo/design-system/components/visual/sketch";
import { getColor } from "@repo/design-system/lib/color";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { ECOLOGY_COLORS } from "@repo/design-system/lib/material/ecology";
import { ENERGY_COLORS } from "@repo/design-system/lib/material/energy";
import { MACHINE_COLORS } from "@repo/design-system/lib/material/machine";
import { ROAD_COLORS } from "@repo/design-system/lib/material/road";
import { SKY_COLORS } from "@repo/design-system/lib/material/sky";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Schema } from "effect";
import type p5 from "p5";
import type { ReactNode } from "react";

/** Wall seconds the whole echo plays over, from the horn to the echo's return. */
const PLAY_SECONDS = 6;

/** Wall seconds the scene holds still after the echo returns, before it starts again. */
const HOLD_SECONDS = 1.6;

/** What the sketch reads on every frame. */
const EchoFrameSchema = Schema.Struct({
  boat: Schema.Finite,
  sound: Schema.Finite,
  time: Schema.Finite,
});
type EchoFrame = typeof EchoFrameSchema.Type;

/** Sky, sea and the cliff on the right, seen from the side. */
function paintCoast(sketch: p5, cliff: number, sea: number) {
  const { height, width } = sketch;
  gradientRect(sketch, { height: sea, width, x: 0, y: 0 }, [
    [0, SKY_COLORS.skyZenith],
    [1, SKY_COLORS.skyHaze],
  ]);
  gradientRect(sketch, { height: height - sea, width, x: 0, y: sea }, [
    [0, ECOLOGY_COLORS.seawater],
    [1, ECOLOGY_COLORS.seawaterDeep],
  ]);
  sketch.noStroke();
  sketch.fill(mix(ENERGY_COLORS.rock, getColor("BLACK"), 0.15));
  sketch.beginShape();
  sketch.vertex(cliff, height);
  sketch.vertex(cliff, sea * 0.35);
  sketch.vertex(cliff + width * 0.03, sea * 0.25);
  sketch.vertex(width, sea * 0.2);
  sketch.vertex(width, height);
  sketch.endShape(sketch.CLOSE);
  sketch.fill(mix(ROAD_COLORS.foliage, getColor("BLACK"), 0.1));
  sketch.rect(cliff + width * 0.02, sea * 0.2, width, sea * 0.08);
}

/** A small motor boat with its bow to the right, its waterline at `at`. */
function paintBoat(
  sketch: p5,
  at: { readonly x: number; readonly y: number },
  size: number
) {
  withShadow(
    sketch,
    { blur: 8, color: fade(getColor("BLACK"), 0.4), drop: 3 },
    () => {
      sketch.noStroke();
      sketch.fill(MACHINE_COLORS.hullRed);
      sketch.beginShape();
      sketch.vertex(at.x - size, at.y - size * 0.35);
      sketch.vertex(at.x + size * 1.1, at.y - size * 0.35);
      sketch.vertex(at.x + size * 0.7, at.y + size * 0.1);
      sketch.vertex(at.x - size * 0.9, at.y + size * 0.1);
      sketch.endShape(sketch.CLOSE);
    }
  );
  sketch.fill(MACHINE_COLORS.deckWhite);
  sketch.rect(at.x - size * 0.6, at.y - size * 0.8, size * 0.8, size * 0.45, 3);
  sketch.fill(CAR_COLORS.tintedGlass);
  sketch.rect(at.x - size * 0.5, at.y - size * 0.72, size * 0.6, size * 0.2, 2);
}

/**
 * Draws one moment of the echo: the boat moving toward the cliff, the
 * sound's front running out to the cliff and back, and once it meets the
 * boat, the three distances drawn as bars above the sea.
 */
function echoProgram(sketch: p5, read: () => EchoFrame) {
  // The first frame is the finished state, so a paused card still shows the whole result.
  let clock = PLAY_SECONDS;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const frame = read();
    if (sketch.isLooping()) {
      clock =
        (clock + Math.min(sketch.deltaTime / 1000, 0.1)) %
        (PLAY_SECONDS + HOLD_SECONDS);
    }
    const { height, width } = sketch;
    const trip = echo(frame.boat, frame.sound, frame.time);
    const sea = height * 0.62;
    const start = width * 0.08;
    const cliff = width * 0.9;
    const scale = (cliff - start) / trip.start;
    paintCoast(sketch, cliff, sea);
    const seconds = Math.min(clock / PLAY_SECONDS, 1) * frame.time;
    const boatX = start + frame.boat * seconds * scale;
    const travelled = frame.sound * seconds;
    const front =
      travelled <= trip.start
        ? start + travelled * scale
        : cliff - (travelled - trip.start) * scale;
    sketch.noFill();
    for (let ring = 0; ring < 3; ring += 1) {
      sketch.stroke(fade(getColor("WHITE"), 0.8 - ring * 0.25));
      sketch.strokeWeight(3 - ring);
      const x = front - (travelled <= trip.start ? ring * 8 : -ring * 8);
      sketch.arc(
        x,
        sea - height * 0.08,
        height * 0.12,
        height * 0.3,
        travelled <= trip.start ? -Math.PI / 2 : Math.PI / 2,
        travelled <= trip.start ? Math.PI / 2 : (Math.PI * 3) / 2
      );
    }
    paintBoat(sketch, { x: boatX, y: sea }, Math.max(14, width * 0.035));
    const bars = height * 0.08;
    const row = (index: number) => sea + bars * (index + 1.2);
    const bar = (index: number, from: number, to: number, color: string) => {
      sketch.stroke(color);
      sketch.strokeWeight(5);
      sketch.line(from, row(index), to, row(index));
      caption(
        sketch,
        `${Math.round(Math.abs(to - from) / scale)} m`,
        { x: (from + to) / 2, y: row(index) - 5 },
        {
          align: "center",
          baseline: "bottom",
          color: fade(getColor("WHITE"), 0.92),
          size: 12,
        }
      );
    };
    bar(0, start, Math.min(front, cliff), PLOT_COLORS.amber);
    if (travelled > trip.start) {
      bar(1, front, cliff, PLOT_COLORS.pink);
    }
    bar(2, start, boatX, PLOT_COLORS.teal);
    vignette(sketch, 0.25);
  };
}

interface EchoLabProps {
  /** The boat's speed toward the cliff, in metres per second. */
  boatSpeed: number;
  description: NonNullable<ReactNode>;
  /** The time from the horn to the echo, in seconds. */
  echoTime: number;
  labels: {
    back: ReactNode;
    boat: ReactNode;
    out: ReactNode;
    start: ReactNode;
    viewLabel: string;
  };
  /** The speed of sound in air, in metres per second. */
  soundSpeed: number;
  title: NonNullable<ReactNode>;
}

/**
 * A boat heading for a cliff sounds its horn and hears the echo a few
 * seconds later. The sound runs out to the cliff and back while the boat
 * keeps moving, so the echo meets it short of where it started. The bars
 * under the sea grow with the sound's way out, its way back and the boat's
 * way forward, and the sound's two ways plus the boat's make twice the
 * starting distance.
 */
export function EchoLab({
  boatSpeed,
  description,
  echoTime,
  labels,
  soundSpeed,
  title,
}: EchoLabProps) {
  const quantity = useQuantity();
  const trip = echo(boatSpeed, soundSpeed, echoTime);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={echoProgram}
          state={{ boat: boatSpeed, sound: soundSpeed, time: echoTime }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.start}
            value={<InlineMath math={quantity(trip.start, "\\text{ m}", 0)} />}
          />
          <VisualFactTabular
            label={labels.out}
            value={<InlineMath math={quantity(trip.start, "\\text{ m}", 0)} />}
          />
          <VisualFactTabular
            label={labels.back}
            value={<InlineMath math={quantity(trip.back, "\\text{ m}", 0)} />}
          />
          <VisualFactTabular
            label={labels.boat}
            value={
              <InlineMath math={quantity(trip.travelled, "\\text{ m}", 0)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
