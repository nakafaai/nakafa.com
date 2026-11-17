import {
  arrow,
  dashed,
  fade,
  gradientRect,
  mix,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import {
  beam,
  type Point,
} from "@repo/design-system/components/contents/physics/optics/light";
import type { Image } from "@repo/design-system/components/contents/physics/optics/ray";
import { getColor } from "@repo/design-system/lib/color";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Option, Schema } from "effect";
import type p5 from "p5";

/**
 * The optical bench of the convex lens lab: a rail with a centimetre scale,
 * a biconvex lens on its carrier, the object arrow and its image, and the
 * three principal rays that locate the image.
 */

/** The bench frame: where the lens and the axis sit, and pixels per centimetre. */
const BenchSchema = Schema.Struct({
  axis: Schema.Finite,
  height: Schema.Finite,
  lens: Schema.Finite,
  scale: Schema.Finite,
});
type Bench = typeof BenchSchema.Type;

/** How far down the canvas the top of the rail runs. */
const RAIL = 0.88;

/** The furthest an image is drawn from the lens, in focal lengths; a farther one leaves the frame. */
const FARTHEST = 5;

/** Fits the object, the focal points on both sides, and the image into the canvas. */
export function fitBench(
  sketch: p5,
  focal: number,
  object: number,
  image: Option.Option<Image>
) {
  const distance = Option.match(image, {
    onNone: () => 2 * focal,
    onSome: (found) => Math.min(Math.abs(found.distance), FARTHEST * focal),
  });
  const virtual = Option.exists(image, (found) => !found.real);
  const left = Math.max(object, 2 * focal, virtual ? distance : 0) * 1.12;
  const right = Math.max(2 * focal, virtual ? 0 : distance) * 1.12;
  const scale = (sketch.width * 0.92) / (left + right);
  const growth = Option.match(image, {
    onNone: () => 1,
    onSome: (found) => Math.max(1, Math.min(Math.abs(found.magnification), 6)),
  });
  return {
    axis: sketch.height * 0.46,
    height: Math.min(sketch.height * 0.17, (sketch.height * 0.36) / growth),
    lens: sketch.width * 0.04 + left * scale,
    scale,
  } satisfies Bench;
}

/** The rail under the axis with a tick every five centimetres and the focal points marked. */
export function paintRail(sketch: p5, bench: Bench, focal: number) {
  const top = sketch.height * RAIL;
  gradientRect(sketch, { height: 10, width: sketch.width, x: 0, y: top }, [
    [0, INSTRUMENT_COLORS.aluminium],
    [1, mix(INSTRUMENT_COLORS.aluminium, getColor("BLACK"), 0.45)],
  ]);
  sketch.stroke(fade(getColor("WHITE"), 0.25));
  sketch.strokeWeight(1);
  sketch.line(0, bench.axis, sketch.width, bench.axis);
  const step = 5 * bench.scale;
  for (let x = bench.lens % step; x < sketch.width; x += step) {
    sketch.stroke(fade(getColor("BLACK"), 0.6));
    sketch.line(x, top + 2, x, top + 7);
  }
  for (const side of [-2, -1, 1, 2]) {
    const x = bench.lens + side * focal * bench.scale;
    sketch.noStroke();
    sketch.fill(
      Math.abs(side) === 1 ? PLOT_COLORS.amber : fade(PLOT_COLORS.amber, 0.5)
    );
    sketch.circle(x, bench.axis, Math.abs(side) === 1 ? 8 : 5);
  }
}

/** A biconvex glass lens standing on its carrier, as tall as `reach` pixels each side of the axis. */
export function paintLens(sketch: p5, bench: Bench, reach: number) {
  const bulge = Math.max(6, reach * 0.12) * 2;
  const drawing = sketch.drawingContext;
  if (drawing instanceof CanvasRenderingContext2D) {
    drawing.save();
    drawing.beginPath();
    drawing.moveTo(bench.lens, bench.axis - reach);
    drawing.quadraticCurveTo(
      bench.lens + bulge,
      bench.axis,
      bench.lens,
      bench.axis + reach
    );
    drawing.quadraticCurveTo(
      bench.lens - bulge,
      bench.axis,
      bench.lens,
      bench.axis - reach
    );
    drawing.closePath();
    drawing.fillStyle = fade(BENCH_COLORS.glass, 0.22);
    drawing.fill();
    drawing.strokeStyle = fade(
      mix(BENCH_COLORS.glass, getColor("WHITE"), 0.5),
      0.8
    );
    drawing.lineWidth = 1.5;
    drawing.stroke();
    drawing.restore();
  }
  sketch.push();
  sketch.noStroke();
  sketch.fill(getColor("NEUTRAL", 800));
  sketch.rect(
    bench.lens - 4,
    bench.axis + reach,
    8,
    Math.max(0, sketch.height * RAIL - bench.axis - reach)
  );
  sketch.pop();
}

/** An upright arrow from the axis to `tip`, as the lit object or, dashed and faint, a virtual image. */
export function paintArrow(
  sketch: p5,
  base: Point,
  tip: Point,
  color: string,
  ghost: boolean
) {
  if (ghost) {
    dashed(sketch, base, tip, { color: fade(color, 0.8), dash: 5, weight: 3 });
    arrow(sketch, { x: tip.x, y: base.y + (tip.y - base.y) * 0.85 }, tip, {
      color: fade(color, 0.8),
      head: 12,
      weight: 3,
    });
    return;
  }
  arrow(sketch, base, tip, { color, head: 13, weight: 4 });
}

/** The point where the line from `from` through `through` reaches the canvas edge it heads for. */
export function toEdge(sketch: p5, from: Point, through: Point) {
  const dx = through.x - from.x;
  const dy = through.y - from.y;
  const limit = dx >= 0 ? sketch.width - from.x : -from.x;
  const t = dx === 0 ? 0 : limit / dx;
  return { x: from.x + dx * t, y: from.y + dy * t };
}

/** One principal ray: its part before the lens, its part after, and, for a virtual image, its dashed extension back. */
export function paintRay(
  sketch: p5,
  parts: {
    readonly after: readonly [Point, Point];
    readonly back: Option.Option<readonly [Point, Point]>;
    readonly before: readonly [Point, Point];
  }
) {
  beam(
    sketch,
    parts.before[0],
    parts.before[1],
    INSTRUMENT_COLORS.lampLight,
    0.85
  );
  beam(
    sketch,
    parts.after[0],
    parts.after[1],
    INSTRUMENT_COLORS.lampLight,
    0.85
  );
  Option.map(parts.back, ([from, to]) =>
    dashed(sketch, from, to, {
      color: fade(INSTRUMENT_COLORS.lampLight, 0.65),
      dash: 6,
      weight: 1.5,
    })
  );
}
