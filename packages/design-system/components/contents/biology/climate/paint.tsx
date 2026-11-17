import type { Point } from "@repo/design-system/components/contents/biology/climate/frame";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { ECOLOGY_COLORS } from "@repo/design-system/lib/material/ecology";
import { Array as Arr, Schema } from "effect";
import type p5 from "p5";

/** A colour stop of a gradient: where along it, and the CSS colour. */
const StopSchema = Schema.Tuple([Schema.Finite, Schema.String]);
type Stop = typeof StopSchema.Type;

/** A layer of a chrome pipe: its share of the pipe's thickness, its colour, and how far it sits toward the light. */
const LayerSchema = Schema.Tuple([Schema.Finite, Schema.String, Schema.Finite]);

/** The 2D context the sketch draws with, for the gradients p5 does not name. */
function contextOf(sketch: p5) {
  const context = sketch.drawingContext;
  return context instanceof CanvasRenderingContext2D ? context : undefined;
}

/** A material colour at an opacity out of 255, as a CSS colour. */
export function tint(sketch: p5, colour: string, alpha: number) {
  const each = sketch.color(colour);
  each.setAlpha(alpha);
  return each.toString();
}

/** Chrome lit by `share`, between its shadow and its body, as a CSS colour. */
export function chromeMid(sketch: p5, share: number) {
  return sketch
    .lerpColor(
      sketch.color(ECOLOGY_COLORS.chromeShadow),
      sketch.color(CAR_COLORS.chrome),
      share
    )
    .toString();
}

/** A gradient with its colour stops added. */
export function stopped(gradient: CanvasGradient, colours: readonly Stop[]) {
  Arr.forEach(colours, ([at, colour]) => gradient.addColorStop(at, colour));
  return gradient;
}

/**
 * Fills what `draw` outlines with the gradient `paint` makes, or with
 * `fallback` where the canvas has no 2D context. The push and pop restore the
 * fill p5 caches, so the next plain fill is not left on the gradient.
 */
export function painted(
  sketch: p5,
  fallback: string,
  paint: (context: CanvasRenderingContext2D) => CanvasGradient,
  draw: () => void
) {
  sketch.push();
  sketch.noStroke();
  sketch.fill(fallback);
  const context = contextOf(sketch);
  if (context !== undefined) {
    context.fillStyle = paint(context);
  }
  draw();
  sketch.pop();
}

/** Draws a closed outline. */
export function shape(sketch: p5, points: readonly Point[]) {
  sketch.beginShape();
  Arr.forEach(points, ([x, y]) => sketch.vertex(x, y));
  sketch.endShape(sketch.CLOSE);
}

/** Draws an open line through `points`. */
export function trace(sketch: p5, points: readonly Point[]) {
  sketch.beginShape();
  Arr.forEach(points, ([x, y]) => sketch.vertex(x, y));
  sketch.endShape();
}

/** Limits what is drawn until the next pop to inside `points`. */
export function clipTo(sketch: p5, points: readonly Point[]) {
  sketch.beginClip();
  shape(sketch, points);
  sketch.endClip();
}

/**
 * Polished chrome across a part from `from` to `to`: a bright band toward
 * the light on the left and the dark room reflected on its far side.
 */
export function chromeAcross(
  sketch: p5,
  context: CanvasRenderingContext2D,
  from: number,
  to: number
) {
  return stopped(context.createLinearGradient(from, 0, to, 0), [
    [0, ECOLOGY_COLORS.chromeShadow],
    [0.14, chromeMid(sketch, 0.7)],
    [0.3, ECOLOGY_COLORS.chromeSpecular],
    [0.44, CAR_COLORS.chrome],
    [0.66, chromeMid(sketch, 0.45)],
    [0.86, ECOLOGY_COLORS.chromeShadow],
    [1, chromeMid(sketch, 0.6)],
  ]);
}

/** Fills a rectangle with chrome lit across its width. */
export function chromeBlock(
  sketch: p5,
  x: number,
  y: number,
  wide: number,
  tall: number
) {
  painted(
    sketch,
    CAR_COLORS.chrome,
    (context) => chromeAcross(sketch, context, x, x + wide),
    () => sketch.rect(x, y, wide, tall, Math.min(1.5, wide / 4))
  );
}

/** A soft elliptical shadow on the floor at `x`, `y`: `spread` wide, `deep` tall and `alpha` dark at its middle. */
export function shadowAt(
  sketch: p5,
  [x, y]: Point,
  spread: number,
  deep: number,
  alpha: number
) {
  sketch.push();
  sketch.translate(x, y);
  sketch.scale(1, deep / spread);
  painted(
    sketch,
    tint(sketch, ECOLOGY_COLORS.chromeShadow, alpha / 3),
    (context) =>
      stopped(context.createRadialGradient(0, 0, 0, 0, 0, spread), [
        [0, tint(sketch, ECOLOGY_COLORS.chromeShadow, alpha)],
        [0.55, tint(sketch, ECOLOGY_COLORS.chromeShadow, alpha * 0.45)],
        [1, tint(sketch, ECOLOGY_COLORS.chromeShadow, 0)],
      ]),
    () => sketch.circle(0, 0, spread * 2)
  );
  sketch.pop();
}

/**
 * Draws a chrome pipe along `points`: a dark rim, its body, a highlight and a
 * specular line on the side that faces the light up and to the left, and the
 * dark room reflected on the far side.
 */
export function drawPipe(
  sketch: p5,
  points: readonly Point[],
  thickness: number
) {
  const offset = (shift: number) =>
    Arr.map(points, (point, index): Point => {
      const before = points[Math.max(0, index - 1)] ?? point;
      const after = points[Math.min(points.length - 1, index + 1)] ?? point;
      const dx = after[0] - before[0];
      const dy = after[1] - before[1];
      const length = Math.hypot(dx, dy) || 1;
      const facing = (dy * 0.6 - dx * 0.8) / length >= 0 ? 1 : -1;
      return [
        point[0] - (dy / length) * facing * shift,
        point[1] + (dx / length) * facing * shift,
      ];
    });
  const layers: readonly (typeof LayerSchema.Type)[] = [
    [1, ECOLOGY_COLORS.chromeShadow, 0],
    [0.8, chromeMid(sketch, 0.55), 0],
    [0.46, CAR_COLORS.chrome, 0.14],
    [0.14, chromeMid(sketch, 0.2), -0.25],
    [0.15, ECOLOGY_COLORS.chromeSpecular, 0.22],
  ];
  sketch.push();
  sketch.noFill();
  sketch.strokeCap(sketch.ROUND);
  sketch.strokeJoin(sketch.ROUND);
  Arr.forEach(layers, ([weight, colour, shift]) => {
    sketch.stroke(colour);
    sketch.strokeWeight(weight * thickness);
    trace(sketch, offset(shift * thickness));
  });
  sketch.pop();
}
