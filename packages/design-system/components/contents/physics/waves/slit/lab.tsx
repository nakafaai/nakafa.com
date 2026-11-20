import { caption } from "@repo/design-system/components/contents/physics/canvas/caption";
import {
  fade,
  gradientRect,
  mix,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import {
  beam,
  paintBenchTop,
  paintDarkRoom,
} from "@repo/design-system/components/contents/physics/optics/light";
import {
  fringeSpacing,
  fringesInSpan,
} from "@repo/design-system/components/contents/physics/waves/wave";
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
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Option, Schema } from "effect";
import type p5 from "p5";
import type { ReactNode } from "react";
import { useState } from "react";

/** How much of the screen the close-up shows each side of the centre, in millimetres. */
const SCREEN_HALF = 20;

/** What the sketch reads on every frame. */
const SlitFrameSchema = Schema.Struct({
  distance: Schema.Finite,
  separation: Schema.Finite,
  span: Schema.optionalKey(Schema.Finite),
  wavelength: Schema.Finite,
});
type SlitFrame = typeof SlitFrameSchema.Type;

/** The fringe spacing on the screen, in millimetres, for a frame. */
function spacingOf(frame: SlitFrame) {
  return (
    fringeSpacing(
      frame.wavelength * 1e-9,
      frame.separation * 1e-3,
      frame.distance
    ) * 1000
  );
}

/**
 * The bench seen from the side across the top: the laser, the double slit,
 * and the screen at its distance, drawn to scale along the bench, with the
 * beam spreading from the slits to the screen.
 */
function paintBench(sketch: p5, frame: SlitFrame) {
  const top = sketch.height * 0.3;
  paintBenchTop(sketch, top);
  const laser = { x: sketch.width * 0.06, y: top - sketch.height * 0.08 };
  const slit = sketch.width * 0.24;
  const metre = (sketch.width * 0.7) / 3;
  const screen = slit + frame.distance * metre;
  sketch.noStroke();
  sketch.fill(getColor("NEUTRAL", 800));
  sketch.rect(
    laser.x - sketch.width * 0.04,
    laser.y - 9,
    sketch.width * 0.09,
    18,
    4
  );
  sketch.fill(INSTRUMENT_COLORS.laserBeam);
  sketch.circle(laser.x + sketch.width * 0.05, laser.y, 5);
  beam(
    sketch,
    { x: laser.x + sketch.width * 0.05, y: laser.y },
    { x: slit, y: laser.y },
    INSTRUMENT_COLORS.laserBeam
  );
  sketch.noStroke();
  sketch.fill(fade(INSTRUMENT_COLORS.laserBeam, 0.12));
  sketch.triangle(
    slit,
    laser.y,
    screen,
    laser.y - sketch.height * 0.09,
    screen,
    laser.y + sketch.height * 0.09
  );
  sketch.fill(getColor("NEUTRAL", 700));
  sketch.rect(
    slit - 2,
    laser.y - sketch.height * 0.1,
    4,
    sketch.height * 0.1 + top - laser.y
  );
  sketch.fill(INSTRUMENT_COLORS.paper);
  sketch.rect(
    screen - 3,
    laser.y - sketch.height * 0.11,
    6,
    sketch.height * 0.11 + top - laser.y
  );
  sketch.stroke(fade(PLOT_COLORS.teal, 0.9));
  sketch.strokeWeight(1.5);
  sketch.line(slit, top + 10, screen, top + 10);
  sketch.line(slit, top + 5, slit, top + 15);
  sketch.line(screen, top + 5, screen, top + 15);
}

/**
 * The screen face in close-up below: red bright fringes whose brightness
 * follows cos² of the phase between the two slits, a millimetre scale, and,
 * when a span is given, the two marks P and Q and the fringes counted
 * between them.
 */
function paintScreen(sketch: p5, frame: SlitFrame) {
  const box = {
    height: sketch.height * 0.36,
    width: sketch.width * 0.92,
    x: sketch.width * 0.04,
    y: sketch.height * 0.46,
  };
  gradientRect(sketch, box, [
    [0, mix(INSTRUMENT_COLORS.paper, getColor("BLACK"), 0.82)],
    [1, mix(INSTRUMENT_COLORS.paper, getColor("BLACK"), 0.88)],
  ]);
  const spacing = spacingOf(frame);
  const centre = box.x + box.width / 2;
  const millimetre = box.width / (SCREEN_HALF * 2);
  const start = Option.match(Option.fromNullishOr(frame.span), {
    onNone: () => 0,
    onSome: (span) => -Math.floor(span / spacing / 2) * spacing,
  });
  for (let x = box.x; x < box.x + box.width; x += 1) {
    const along = (x - centre) / millimetre - start;
    const bright = Math.cos((Math.PI * along) / spacing) ** 2;
    sketch.stroke(fade(INSTRUMENT_COLORS.laserBeam, bright * 0.95));
    sketch.strokeWeight(1.2);
    sketch.line(x, box.y + box.height * 0.12, x, box.y + box.height * 0.7);
  }
  sketch.stroke(fade(getColor("WHITE"), 0.6));
  sketch.strokeWeight(1);
  for (let mark = -SCREEN_HALF; mark <= SCREEN_HALF; mark += 1) {
    const x = centre + mark * millimetre;
    const tall = mark % 5 === 0 ? 10 : 5;
    sketch.line(
      x,
      box.y + box.height * 0.78,
      x,
      box.y + box.height * 0.78 + tall
    );
  }
  Option.map(Option.fromNullishOr(frame.span), (span) => {
    const count = fringesInSpan(span, spacing);
    const left = centre + start * millimetre;
    const right = left + span * millimetre;
    sketch.noStroke();
    for (let index = 0; index < count; index += 1) {
      const x = left + index * spacing * millimetre;
      sketch.fill(PLOT_COLORS.amber);
      sketch.circle(x, box.y + box.height * 0.08, 7);
    }
    sketch.stroke(PLOT_COLORS.amber);
    sketch.strokeWeight(2);
    sketch.line(
      left,
      box.y + box.height * 0.92,
      right,
      box.y + box.height * 0.92
    );
    sketch.line(
      left,
      box.y + box.height * 0.86,
      left,
      box.y + box.height * 0.98
    );
    sketch.line(
      right,
      box.y + box.height * 0.86,
      right,
      box.y + box.height * 0.98
    );
    const mark = {
      align: "center",
      baseline: "top",
      color: PLOT_COLORS.amber,
      size: 13,
    } as const;
    caption(sketch, "P", { x: left, y: box.y + box.height + 6 }, mark);
    caption(sketch, "Q", { x: right, y: box.y + box.height + 6 }, mark);
  });
}

/** Draws the bench and the screen close-up. */
function slitProgram(sketch: p5, read: () => SlitFrame) {
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const frame = read();
    paintDarkRoom(sketch);
    paintBench(sketch, frame);
    paintScreen(sketch, frame);
    vignette(sketch, 0.3);
  };
}

interface DoubleSlitLabProps {
  description: NonNullable<ReactNode>;
  /** The distance from the slits to the screen the lab starts at, in metres. */
  distance: number;
  labels: {
    count: ReactNode;
    distance: ReactNode;
    distanceName: string;
    separation: ReactNode;
    separationName: string;
    spacing: ReactNode;
    viewLabel: string;
  };
  /** The slit separation the lab starts at, in millimetres. */
  separation: number;
  /** A distance along the screen, in millimetres, from one bright fringe to another, whose fringes the lab counts. */
  span?: number;
  title: NonNullable<ReactNode>;
  /** The wavelength of the light, in nanometres. */
  wavelength: number;
}

/**
 * Young's double slit on an optics bench: a laser lights two narrow slits,
 * and the light from them overlaps on a screen in bright and dark fringes
 * x = λD/a apart. Move the screen or change the slits and watch the fringes
 * spread or close up; with a span marked, count the bright fringes in it,
 * both ends included.
 */
export function DoubleSlitLab({
  description,
  distance: startDistance,
  labels,
  separation: startSeparation,
  span,
  title,
  wavelength,
}: DoubleSlitLabProps) {
  const quantity = useQuantity();
  const [distance, setDistance] = useState(startDistance);
  const [separation, setSeparation] = useState(startSeparation);
  const spacing =
    fringeSpacing(wavelength * 1e-9, separation * 1e-3, distance) * 1000;

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <div className="flex w-full flex-col gap-4">
          <LabSlider
            label={<span>{labels.separation}</span>}
            max={0.6}
            min={0.1}
            name={labels.separationName}
            onValueChange={setSeparation}
            readout={
              <InlineMath math={quantity(separation, "\\text{ mm}", 2)} />
            }
            step={0.05}
            value={separation}
          />
          <LabSlider
            label={<span>{labels.distance}</span>}
            max={3}
            min={0.5}
            name={labels.distanceName}
            onValueChange={setDistance}
            readout={<InlineMath math={quantity(distance, "\\text{ m}", 1)} />}
            step={0.1}
            value={distance}
          />
        </div>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={slitProgram}
          state={
            span === undefined
              ? { distance, separation, wavelength }
              : { distance, separation, span, wavelength }
          }
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.spacing}
            value={
              <InlineMath math={`x=${quantity(spacing, "\\text{ mm}", 2)}`} />
            }
          />
          {span === undefined ? null : (
            <VisualFactTabular
              label={labels.count}
              value={<InlineMath math={`${fringesInSpan(span, spacing)}`} />}
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
