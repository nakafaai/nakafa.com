import {
  dashed,
  fade,
  gradientRect,
  litBall,
  mix,
  spotlight,
  vignette,
  withShadow,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { useFixed } from "@repo/design-system/components/contents/physics/measurement/digits";
import {
  CYLINDER_RADIUS,
  CYLINDER_VOLUME,
  EYE_DISTANCE,
  EYE_RANGE,
  levelOf,
  parallaxReading,
  TRUE_VOLUME,
} from "@repo/design-system/components/contents/physics/measurement/parallax/meniscus";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { Slider } from "@repo/design-system/components/ui/slider";
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
import { Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** How far the meniscus climbs the glass above its bottom, in centimetres. */
const MENISCUS_RISE = 0.12;

/** The half height of the magnifier's window around the meniscus, in centimetres. */
const LENS_HALF = 1.1;

/** How quickly the eye moves to a new height, per second. */
const MOVE_RATE = 6;

/** What the sketch reads on every frame: the eye's height above the meniscus. */
const EyeFrame = Schema.Struct({ offset: Schema.Number });

/** Positions of the bench, the cylinder and the magnifier for one canvas size. */
function layout(sketch: p5) {
  const { height, width } = sketch;
  const lens = Math.min(width * 0.4, height * 0.84);
  return {
    base: height * 0.88,
    centre: width * 0.4,
    eye: width * 0.09,
    lens,
    lensLeft: width * 0.97 - lens,
    lensTop: (height - lens) / 2,
    rise: (height * 0.72) / levelOf(CYLINDER_VOLUME),
    wall: width * 0.055,
  };
}

/** The wall, the bench top and the lamp light. */
function paintRoom(sketch: p5, place: ReturnType<typeof layout>) {
  const { height, width } = sketch;
  gradientRect(sketch, { height, width, x: 0, y: 0 }, [
    [0, mix(getColor("SLATE", 600), getColor("WHITE"), 0.15)],
    [0.85, getColor("SLATE", 700)],
    [1, getColor("SLATE", 800)],
  ]);
  spotlight(sketch, { x: width * 0.35, y: height * 0.3 }, width * 0.55, {
    color: mix(getColor("SLATE", 200), getColor("WHITE"), 0.6),
    strength: 0.28,
  });
  gradientRect(sketch, { height: height - place.base, width, x: 0, y: place.base }, [
    [0, mix(getColor("STONE", 600), getColor("WHITE"), 0.25)],
    [1, mix(getColor("STONE", 600), getColor("BLACK"), 0.5)],
  ]);
}

/** The measuring cylinder with its water and marks, and the eye looking at it. */
function paintCylinder(sketch: p5, place: ReturnType<typeof layout>, offset: number) {
  const { height } = sketch;
  const top = place.base - levelOf(CYLINDER_VOLUME) * place.rise - height * 0.03;
  const water = place.base - levelOf(TRUE_VOLUME) * place.rise;
  const left = place.centre - place.wall;
  withShadow(sketch, { blur: 18, color: fade(getColor("BLACK"), 0.45), drop: 6 }, () => {
    sketch.fill(fade(getColor("SLATE", 200), 0.18));
    sketch.rect(left, top, place.wall * 2, place.base - top, 0, 0, 4, 4);
  });
  gradientRect(sketch, { height: place.base - water, width: place.wall * 2, x: left, y: water }, [
    [0, fade(mix(PLOT_COLORS.teal, getColor("WHITE"), 0.35), 0.65)],
    [1, fade(PLOT_COLORS.teal, 0.8)],
  ]);
  sketch.fill(fade(mix(PLOT_COLORS.teal, getColor("WHITE"), 0.5), 0.8));
  sketch.arc(place.centre, water, place.wall * 2, height * 0.02, 0, Math.PI);
  sketch.stroke(fade(getColor("WHITE"), 0.6));
  sketch.strokeWeight(1);
  for (let volume = 0; volume <= CYLINDER_VOLUME; volume += 5) {
    const y = place.base - levelOf(volume) * place.rise;
    sketch.line(left, y, left + place.wall * (volume % 10 === 0 ? 0.7 : 0.4), y);
  }
  sketch.stroke(fade(getColor("WHITE"), 0.45));
  sketch.strokeWeight(3);
  sketch.line(left + place.wall * 0.3, top + 6, left + place.wall * 0.3, place.base - 6);
  sketch.noStroke();
  sketch.fill(fade(getColor("SLATE", 200), 0.35));
  sketch.quad(left - place.wall, place.base, left + place.wall * 3, place.base, left + place.wall * 2.4, place.base - height * 0.025, left - place.wall * 0.4, place.base - height * 0.025);
  const eyeY = water - offset * place.rise;
  dashed(sketch, { x: place.eye + height * 0.03, y: eyeY }, { x: place.centre, y: water }, {
    color: PLOT_COLORS.fuchsia,
    dash: 6,
    weight: 2,
  });
  litBall(sketch, { x: place.eye, y: eyeY }, height * 0.035, {
    dark: getColor("SLATE", 300),
    light: getColor("WHITE"),
  });
  sketch.fill(mix(PLOT_COLORS.amber, getColor("BLACK"), 0.55));
  sketch.circle(place.eye + height * 0.022, eyeY, height * 0.03);
  sketch.fill(getColor("ZINC", 950));
  sketch.circle(place.eye + height * 0.027, eyeY, height * 0.014);
  sketch.noFill();
  sketch.stroke(fade(PLOT_COLORS.fuchsia, 0.85));
  sketch.strokeWeight(1.5);
  sketch.rect(left - 6, water - LENS_HALF * place.rise, place.wall + 12, LENS_HALF * place.rise * 2, 3);
  sketch.line(place.centre + 6, water - LENS_HALF * place.rise, place.lensLeft, place.lensTop);
  sketch.line(place.centre + 6, water + LENS_HALF * place.rise, place.lensLeft, place.lensTop + place.lens);
  sketch.noStroke();
}

/**
 * The magnifier on the meniscus, drawn to scale: the glass wall with its
 * millilitre marks, the water's curved surface, the true level in teal, and
 * the sight line crossing the wall where the eye reads.
 */
function paintLens(sketch: p5, place: ReturnType<typeof layout>, offset: number) {
  const { level, seen } = parallaxReading(offset);
  const scale = place.lens / (LENS_HALF * 2);
  const from = -CYLINDER_RADIUS - 0.55;
  const toX = (x: number) => place.lensLeft + (x - from) * scale;
  const toY = (y: number) => place.lensTop + place.lens / 2 - (y - level) * scale;
  withShadow(sketch, { blur: 24, color: fade(getColor("BLACK"), 0.7), drop: 10 }, () => {
    sketch.fill(getColor("ZINC", 900));
    sketch.rect(place.lensLeft, place.lensTop, place.lens, place.lens, 14);
  });
  sketch.push();
  const drawing = sketch.drawingContext;
  if (drawing instanceof CanvasRenderingContext2D) {
    drawing.beginPath();
    drawing.roundRect(place.lensLeft, place.lensTop, place.lens, place.lens, 14);
    drawing.clip();
  }
  gradientRect(sketch, { height: place.lens, width: place.lens, x: place.lensLeft, y: place.lensTop }, [
    [0, mix(getColor("SLATE", 600), getColor("WHITE"), 0.25)],
    [1, getColor("SLATE", 700)],
  ]);
  const wall = toX(-CYLINDER_RADIUS);
  sketch.fill(fade(PLOT_COLORS.teal, 0.75));
  sketch.beginShape();
  for (let step = 0; step <= 24; step += 1) {
    const x = -CYLINDER_RADIUS + (CYLINDER_RADIUS * 1.6 * step) / 24;
    sketch.vertex(toX(x), toY(level + MENISCUS_RISE * (x / CYLINDER_RADIUS) ** 2));
  }
  sketch.vertex(place.lensLeft + place.lens, place.lensTop + place.lens);
  sketch.vertex(wall, place.lensTop + place.lens);
  sketch.endShape(sketch.CLOSE);
  gradientRect(sketch, { height: place.lens, width: scale * 0.14, x: wall - scale * 0.14, y: place.lensTop }, [
    [0, fade(getColor("WHITE"), 0.5)],
    [0.5, fade(getColor("SLATE", 200), 0.25)],
    [1, fade(getColor("WHITE"), 0.4)],
  ], true);
  sketch.stroke(getColor("WHITE"));
  for (let volume = Math.ceil(TRUE_VOLUME - 8); volume <= TRUE_VOLUME + 8; volume += 1) {
    const y = toY(levelOf(volume));
    sketch.strokeWeight(volume % 5 === 0 ? 3 : 2);
    sketch.line(wall - scale * 0.14, y, wall - scale * (volume % 5 === 0 ? 0.42 : 0.28), y);
  }
  sketch.stroke(PLOT_COLORS.teal);
  sketch.strokeWeight(3);
  sketch.line(wall - scale * 0.45, toY(level), toX(0), toY(level));
  sketch.stroke(PLOT_COLORS.fuchsia);
  sketch.strokeWeight(4);
  sketch.line(wall - scale * 0.45, toY(seen), wall, toY(seen));
  sketch.noStroke();
  dashed(sketch, { x: toX(from), y: toY(level + (offset * -from) / EYE_DISTANCE) }, { x: toX(0), y: toY(level) }, {
    color: PLOT_COLORS.fuchsia,
    dash: 8,
    weight: 2.5,
  });
  sketch.pop();
}

/** Draws one moment: the eye drifts to its height, and the magnifier follows its sight line. */
function eyeProgram(sketch: p5, read: () => typeof EyeFrame.Type) {
  let shown = read().offset;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
    sketch.noStroke();
  };
  sketch.draw = () => {
    const { offset } = read();
    const step = Math.min(sketch.deltaTime / 1000, 0.1) * MOVE_RATE;
    shown = sketch.isLooping() ? shown + (offset - shown) * Math.min(step, 1) : offset;
    const place = layout(sketch);
    paintRoom(sketch, place);
    paintCylinder(sketch, place, shown);
    paintLens(sketch, place, shown);
    vignette(sketch, 0.35);
  };
}

interface ParallaxReadingLabProps {
  description: ReactNode;
  labels: {
    error: ReactNode;
    eye: string;
    reading: ReactNode;
    trueVolume: ReactNode;
    viewLabel: string;
  };
  /** How far above the meniscus the eye starts, in centimetres. */
  offset?: number;
  title: ReactNode;
}

/**
 * An eye reading the water in a measuring cylinder. Move the eye up or down:
 * its sight line to the bottom of the meniscus crosses the scale on the front
 * wall higher or lower than the water, so the reading drifts from the truth.
 */
export function ParallaxReadingLab({ description, labels, offset: initialOffset = 6, title }: ParallaxReadingLabProps) {
  const [offset, setOffset] = useState(initialOffset);
  const fixed = useFixed();
  const { error, reading } = parallaxReading(offset);
  const signed = (value: number, unit: string, digits: number) =>
    `${value > 0 ? "+" : ""}${fixed(value, unit, digits)}`;

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <div className="flex w-full flex-col gap-3">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span>{labels.eye}</span>
            <span className="shrink-0 tabular-nums">
              <InlineMath math={signed(offset, "\\text{ cm}", 1)} />
            </span>
          </div>
          <Slider aria-label={labels.eye} max={EYE_RANGE} min={-EYE_RANGE} onValueChange={setOffset} step={0.5} value={offset} />
        </div>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch label={labels.viewLabel} program={eyeProgram} state={{ offset }} />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular label={labels.trueVolume} value={<InlineMath math={fixed(TRUE_VOLUME, "\\text{ mL}", 1)} />} />
          <VisualFactTabular label={labels.reading} value={<InlineMath math={fixed(reading, "\\text{ mL}", 1)} />} />
          <VisualFactTabular label={labels.error} value={<InlineMath math={signed(Math.round(error * 10) / 10, "\\text{ mL}", 1)} />} />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
