import { getColor } from "@repo/design-system/lib/color";
import { Schema } from "effect";
import type p5 from "p5";

/**
 * Painting helpers the physics sketches share. p5 draws flat shapes; these
 * give them the light of a photograph: gradients that fall off like a lit
 * surface, soft cast shadows, and arrows whose heads keep their size at any
 * scale. Each restores the canvas state it changes.
 */

/** A point on the canvas, in pixels. */
export const PointSchema = Schema.Struct({
  x: Schema.Finite,
  y: Schema.Finite,
});
type Point = typeof PointSchema.Type;

/** The 2D context under a p5 canvas, which carries gradients and shadows. */
function context(sketch: p5) {
  const drawing = sketch.drawingContext;
  return drawing instanceof CanvasRenderingContext2D ? drawing : undefined;
}

/**
 * A color part way from `from` to `to`, as six-digit hex: the palette holds a
 * few neutral shades, and a lit surface needs the tones between them.
 */
export function mix(from: string, to: string, amount: number) {
  const channel = (color: string, start: number) =>
    Number.parseInt(color.slice(start, start + 2), 16);
  const blend = (start: number) =>
    Math.round(
      channel(from, start) +
        (channel(to, start) - channel(from, start)) * amount
    )
      .toString(16)
      .padStart(2, "0");
  return `#${blend(1)}${blend(3)}${blend(5)}`;
}

/** A color with an opacity from 0 to 1, as eight-digit hex. */
export function fade(color: string, opacity: number) {
  const alpha = Math.round(Math.min(Math.max(opacity, 0), 1) * 255);
  return `${color.slice(0, 7)}${alpha.toString(16).padStart(2, "0")}`;
}

/**
 * Fills a rectangle with a gradient from `from` to `to`, top to bottom by
 * default or left to right, as a lit wall or a polished bench reads.
 */
export function gradientRect(
  sketch: p5,
  box: {
    readonly height: number;
    readonly width: number;
    readonly x: number;
    readonly y: number;
  },
  stops: readonly (readonly [offset: number, color: string])[],
  across = false
) {
  const drawing = context(sketch);
  if (!drawing) {
    return;
  }
  const gradient = across
    ? drawing.createLinearGradient(box.x, 0, box.x + box.width, 0)
    : drawing.createLinearGradient(0, box.y, 0, box.y + box.height);
  for (const [offset, color] of stops) {
    gradient.addColorStop(offset, color);
  }
  drawing.save();
  drawing.fillStyle = gradient;
  drawing.fillRect(box.x, box.y, box.width, box.height);
  drawing.restore();
}

/**
 * Fills a circle with light that falls off from its upper left, so a ball
 * reads as a sphere lit from above.
 */
export function litBall(
  sketch: p5,
  center: Point,
  radius: number,
  colors: { readonly dark: string; readonly light: string }
) {
  const drawing = context(sketch);
  if (!drawing) {
    return;
  }
  const gradient = drawing.createRadialGradient(
    center.x - radius * 0.35,
    center.y - radius * 0.4,
    radius * 0.1,
    center.x,
    center.y,
    radius
  );
  gradient.addColorStop(0, colors.light);
  gradient.addColorStop(1, colors.dark);
  drawing.save();
  drawing.fillStyle = gradient;
  drawing.beginPath();
  drawing.arc(center.x, center.y, radius, 0, Math.PI * 2);
  drawing.fill();
  drawing.restore();
}

/**
 * Draws whatever `paint` draws with a soft shadow under it, offset down as
 * light from above casts it.
 */
export function withShadow(
  sketch: p5,
  shadow: {
    readonly blur: number;
    readonly color: string;
    readonly drop: number;
  },
  paint: () => void
) {
  const drawing = context(sketch);
  if (!drawing) {
    paint();
    return;
  }
  // p5 caches the fill and stroke it last set; its push and pop save and
  // restore that cache with the context, where a bare save and restore would
  // leave the cache naming a color the context no longer has.
  sketch.push();
  drawing.shadowBlur = shadow.blur;
  drawing.shadowColor = shadow.color;
  drawing.shadowOffsetY = shadow.drop;
  paint();
  sketch.pop();
}

/**
 * Draws whatever `paint` draws blurred, as a lens shows what lies outside its
 * focus. Used for far backgrounds, so the subject stays sharp in front.
 */
export function outOfFocus(sketch: p5, blur: number, paint: () => void) {
  const drawing = context(sketch);
  if (!drawing || blur <= 0) {
    paint();
    return;
  }
  sketch.push();
  drawing.filter = `blur(${blur}px)`;
  paint();
  sketch.pop();
}

/**
 * Draws an arrow from `from` to `to` with a filled head of a fixed size, in
 * pixels, so a short vector still shows its direction.
 */
export function arrow(
  sketch: p5,
  from: Point,
  to: Point,
  style: {
    readonly color: string;
    readonly head: number;
    readonly weight: number;
  }
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length < 1) {
    return;
  }
  const head = Math.min(style.head, length * 0.6);
  const ux = dx / length;
  const uy = dy / length;
  const baseX = to.x - ux * head;
  const baseY = to.y - uy * head;
  sketch.push();
  sketch.stroke(style.color);
  sketch.strokeWeight(style.weight);
  sketch.strokeCap(sketch.SQUARE);
  sketch.line(from.x, from.y, baseX, baseY);
  sketch.noStroke();
  sketch.fill(style.color);
  sketch.triangle(
    to.x,
    to.y,
    baseX - uy * head * 0.5,
    baseY + ux * head * 0.5,
    baseX + uy * head * 0.5,
    baseY - ux * head * 0.5
  );
  sketch.pop();
}

/** Draws a dashed line, as a construction line or a path still to come. */
export function dashed(
  sketch: p5,
  from: Point,
  to: Point,
  style: {
    readonly color: string;
    readonly dash: number;
    readonly weight: number;
  }
) {
  const drawing = context(sketch);
  sketch.push();
  sketch.stroke(style.color);
  sketch.strokeWeight(style.weight);
  drawing?.setLineDash([style.dash, style.dash]);
  sketch.line(from.x, from.y, to.x, to.y);
  drawing?.setLineDash([]);
  sketch.pop();
}

/**
 * Lays a pool of light on the background, brightest at `center` and gone at
 * `radius`, as a lamp lights the wall behind a bench.
 */
export function spotlight(
  sketch: p5,
  center: Point,
  radius: number,
  light: { readonly color: string; readonly strength: number }
) {
  const drawing = context(sketch);
  if (!drawing) {
    return;
  }
  const gradient = drawing.createRadialGradient(
    center.x,
    center.y,
    0,
    center.x,
    center.y,
    radius
  );
  gradient.addColorStop(0, fade(light.color, light.strength));
  gradient.addColorStop(1, fade(light.color, 0));
  drawing.save();
  drawing.fillStyle = gradient;
  drawing.fillRect(
    center.x - radius,
    center.y - radius,
    radius * 2,
    radius * 2
  );
  drawing.restore();
}

/**
 * Darkens the corners of the frame, as a lens does, which pulls the eye to
 * the middle of the scene.
 */
export function vignette(sketch: p5, strength: number) {
  const drawing = context(sketch);
  if (!drawing) {
    return;
  }
  const { height, width } = sketch;
  const gradient = drawing.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.35,
    width / 2,
    height / 2,
    Math.hypot(width, height) * 0.6
  );
  gradient.addColorStop(0, fade(getColor("BLACK"), 0));
  gradient.addColorStop(1, fade(getColor("BLACK"), strength));
  drawing.save();
  drawing.fillStyle = gradient;
  drawing.fillRect(0, 0, width, height);
  drawing.restore();
}

/**
 * A layer for the scenery that never moves: it is painted once into an
 * offscreen buffer and copied onto the canvas every frame after, so a slow
 * phone spends its frame on what moves. It paints again only when the
 * canvas size or the `key` of what it shows changes.
 */
export function createBackdrop() {
  let layer: p5.Graphics | undefined;
  let shown = "";
  return (sketch: p5, key: string, paint: (layer: p5) => void) => {
    const id = `${key}:${sketch.width}x${sketch.height}`;
    if (!layer || shown !== id) {
      layer?.remove();
      layer = sketch.createGraphics(sketch.width, sketch.height);
      paint(layer);
      shown = id;
    }
    context(sketch)?.drawImage(layer.elt, 0, 0, sketch.width, sketch.height);
  };
}
