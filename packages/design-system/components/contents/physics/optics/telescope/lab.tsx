import {
  dashed,
  fade,
  gradientRect,
  mix,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import type { Point } from "@repo/design-system/components/contents/physics/optics/light";
import {
  beam,
  paintDarkRoom,
} from "@repo/design-system/components/contents/physics/optics/light";
import { telescope } from "@repo/design-system/components/contents/physics/optics/ray";
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
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Schema } from "effect";
import type p5 from "p5";
import type { ReactNode } from "react";
import { useState } from "react";

/** The angle, in degrees, at which light from the distant star reaches the objective. */
const STAR_ANGLE = 1.2;

/** The heights, as fractions of the objective's radius, of the three rays drawn from the star. */
const RAY_HEIGHTS = [0.8, 0, -0.8] as const;

/** What the sketch reads on every frame: the two lens powers in dioptres. */
const TelescopeFrameSchema = Schema.Struct({
  eyepiece: Schema.Finite,
  objective: Schema.Finite,
});
type TelescopeFrame = typeof TelescopeFrameSchema.Type;

/** One view of the telescope: which centimetres along the axis it shows, and where on the canvas. */
const ViewSchema = Schema.Struct({
  axis: Schema.Finite,
  from: Schema.Finite,
  left: Schema.Finite,
  scale: Schema.Finite,
});
type View = typeof ViewSchema.Type;

/** A point `x` centimetres behind the objective and `y` centimetres above the axis, in a view. */
function place(view: View, x: number, y: number): Point {
  return {
    x: view.left + (x - view.from) * view.scale,
    y: view.axis - y * view.scale,
  };
}

/** The ray from the star entering the objective `height` centimetres above the axis: where it crosses each lens and leaves. */
function rayThrough(height: number, objective: number, eyepiece: number) {
  const tilt = Math.tan((STAR_ANGLE * Math.PI) / 180);
  const image = -objective * tilt;
  const length = objective + eyepiece;
  const atEyepiece = height + ((image - height) * length) / objective;
  return { atEyepiece, image, length, out: (objective / eyepiece) * tilt };
}

/** A thin lens drawn edge-on as a glass lens shape, `reach` pixels each side of the axis. */
function lensShape(sketch: p5, at: Point, reach: number) {
  const drawing = sketch.drawingContext;
  if (!(drawing instanceof CanvasRenderingContext2D)) {
    return;
  }
  const bulge = Math.max(4, reach * 0.18);
  drawing.save();
  drawing.beginPath();
  drawing.moveTo(at.x, at.y - reach);
  drawing.quadraticCurveTo(at.x + bulge, at.y, at.x, at.y + reach);
  drawing.quadraticCurveTo(at.x - bulge, at.y, at.x, at.y - reach);
  drawing.fillStyle = fade(BENCH_COLORS.glass, 0.25);
  drawing.fill();
  drawing.strokeStyle = fade(
    mix(BENCH_COLORS.glass, getColor("WHITE"), 0.5),
    0.85
  );
  drawing.lineWidth = 1.5;
  drawing.stroke();
  drawing.restore();
}

/** Draws the rays of the star through both lenses in one view, with the shared focal plane dashed. */
function paintRays(
  sketch: p5,
  view: View,
  frame: TelescopeFrame,
  weight: number
) {
  const scope = telescope(frame.objective, frame.eyepiece);
  const radius = scope.objective * 0.06;
  const tilt = Math.tan((STAR_ANGLE * Math.PI) / 180);
  for (const share of RAY_HEIGHTS) {
    const height = share * radius;
    const ray = rayThrough(height, scope.objective, scope.eyepiece);
    const start = place(
      view,
      -scope.objective * 0.25,
      height + scope.objective * 0.25 * tilt
    );
    const atObjective = place(view, 0, height);
    const atEyepiece = place(view, ray.length, ray.atEyepiece);
    const leave = scope.eyepiece * 3;
    const end = place(
      view,
      ray.length + leave,
      ray.atEyepiece + leave * ray.out
    );
    beam(sketch, start, atObjective, INSTRUMENT_COLORS.lampLight, weight);
    beam(sketch, atObjective, atEyepiece, INSTRUMENT_COLORS.lampLight, weight);
    beam(sketch, atEyepiece, end, INSTRUMENT_COLORS.lampLight, weight);
  }
  const top = place(view, scope.objective, radius * 1.1);
  const bottom = place(view, scope.objective, -radius * 1.1);
  dashed(sketch, top, bottom, {
    color: fade(PLOT_COLORS.amber, 0.8),
    dash: 5,
    weight: 1.5,
  });
  sketch.noStroke();
  sketch.fill(PLOT_COLORS.amber);
  const image = place(view, scope.objective, -scope.objective * tilt);
  sketch.circle(image.x, image.y, 7);
}

/**
 * Draws the whole telescope to scale across the top, with its tube, both
 * lenses and the rays from a distant star, and below it a magnified view of
 * the eyepiece end, where the rays cross at the shared focal point and leave
 * the eyepiece parallel at a steeper angle.
 */
function telescopeProgram(sketch: p5, read: () => TelescopeFrame) {
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const frame = read();
    const scope = telescope(frame.objective, frame.eyepiece);
    const radius = scope.objective * 0.06;
    paintDarkRoom(sketch);
    const whole = (sketch.width * 0.86) / (scope.length * 1.15);
    const top: View = {
      axis: sketch.height * 0.22,
      from: -scope.length * 0.08,
      left: sketch.width * 0.05,
      scale: whole,
    };
    const tubeStart = place(top, -scope.objective * 0.02, radius * 1.25);
    const tubeEnd = place(
      top,
      scope.length + scope.eyepiece * 0.4,
      -radius * 1.25
    );
    gradientRect(
      sketch,
      {
        height: tubeEnd.y - tubeStart.y,
        width: tubeEnd.x - tubeStart.x,
        x: tubeStart.x,
        y: tubeStart.y,
      },
      [
        [0, fade(getColor("NEUTRAL", 300), 0.18)],
        [0.5, fade(getColor("NEUTRAL", 300), 0.05)],
        [1, fade(getColor("NEUTRAL", 300), 0.18)],
      ]
    );
    paintRays(sketch, top, frame, 0.6);
    lensShape(sketch, place(top, 0, 0), radius * whole);
    lensShape(
      sketch,
      place(top, scope.length, 0),
      Math.max(radius * 0.4 * whole, 6)
    );
    const zoomFrom = scope.objective - scope.eyepiece * 1.6;
    const zoomTo = scope.length + scope.eyepiece * 2.2;
    const inset: View = {
      axis: sketch.height * 0.68,
      from: zoomFrom,
      left: sketch.width * 0.06,
      scale: (sketch.width * 0.88) / (zoomTo - zoomFrom),
    };
    const box = {
      height: sketch.height * 0.5,
      width: sketch.width * 0.92,
      x: sketch.width * 0.04,
      y: sketch.height * 0.43,
    };
    gradientRect(sketch, box, [
      [0, fade(getColor("ZINC", 950), 0.85)],
      [1, fade(getColor("ZINC", 900), 0.85)],
    ]);
    sketch.noFill();
    sketch.stroke(fade(PLOT_COLORS.violet, 0.8));
    sketch.strokeWeight(1.5);
    sketch.rect(box.x, box.y, box.width, box.height, 8);
    const from = place(top, zoomFrom, radius);
    const to = place(top, zoomTo, -radius);
    sketch.rect(from.x, from.y, to.x - from.x, to.y - from.y, 3);
    const drawing = sketch.drawingContext;
    if (drawing instanceof CanvasRenderingContext2D) {
      drawing.save();
      drawing.beginPath();
      drawing.rect(box.x, box.y, box.width, box.height);
      drawing.clip();
      paintRays(sketch, inset, frame, 1);
      lensShape(
        sketch,
        place(inset, scope.length, 0),
        radius * 0.45 * inset.scale
      );
      drawing.restore();
    }
    vignette(sketch, 0.3);
  };
}

interface TelescopeLabProps {
  description: NonNullable<ReactNode>;
  /** The power of the eyepiece the lab starts with, in dioptres. */
  eyepiecePower: number;
  labels: {
    eyepiece: ReactNode;
    eyepieceName: string;
    length: ReactNode;
    magnification: ReactNode;
    objective: ReactNode;
    viewLabel: string;
  };
  /** The power of the objective lens, in dioptres. */
  objectivePower: number;
  title: NonNullable<ReactNode>;
}

/**
 * An astronomical telescope in normal adjustment, drawn to scale with a
 * magnified view of its eyepiece end. Light from a distant star enters the
 * objective as a parallel beam, meets at the focal point both lenses share,
 * and leaves the eyepiece parallel again at a steeper angle: the angle grows
 * by the ratio of the focal lengths. Change the eyepiece and watch the tube's
 * length and the magnification change together.
 */
export function TelescopeLab({
  description,
  eyepiecePower: start,
  labels,
  objectivePower,
  title,
}: TelescopeLabProps) {
  const quantity = useQuantity();
  const [eyepiece, setEyepiece] = useState(start);
  const scope = telescope(objectivePower, eyepiece);

  return (
    <VisualCard
      onReset={() => {
        setEyepiece(start);
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <LabSlider
          label={<span>{labels.eyepiece}</span>}
          max={Math.max(40, Math.ceil(start * 2))}
          min={Math.max(2, Math.ceil(objectivePower * 2))}
          name={labels.eyepieceName}
          onValueChange={setEyepiece}
          readout={<InlineMath math={quantity(eyepiece, "\\text{ D}", 0)} />}
          step={1}
          value={eyepiece}
        />
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={telescopeProgram}
          state={{ eyepiece, objective: objectivePower }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.objective}
            value={
              <InlineMath
                math={`f_o=${quantity(scope.objective, "\\text{ cm}", 1)}`}
              />
            }
          />
          <VisualFactTabular
            label={labels.eyepiece}
            value={
              <InlineMath
                math={`f_e=${quantity(scope.eyepiece, "\\text{ cm}", 1)}`}
              />
            }
          />
          <VisualFactTabular
            label={labels.length}
            value={
              <InlineMath math={quantity(scope.length, "\\text{ cm}", 1)} />
            }
          />
          <VisualFactTabular
            label={labels.magnification}
            value={
              <InlineMath math={quantity(scope.magnification, "\\times", 1)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
