import { fade } from "@repo/design-system/components/contents/physics/canvas/paint";
import { getColor } from "@repo/design-system/lib/color";
import type p5 from "p5";

/**
 * The sprite tools the field's animals share: each animal is painted once
 * into a small offscreen layer for its size, lit by a gradient kept inside
 * its silhouette, with its soft shadow painted into a layer of its own, and
 * stamped turned along its way on every frame.
 */

/** The 2D context under a p5 canvas or layer, which carries gradients and shadows. */
export function context(sketch: p5) {
  const drawing = sketch.drawingContext;
  return drawing instanceof CanvasRenderingContext2D ? drawing : undefined;
}

/** The shadows' ink: near-black, faded where it is drawn. */
export const SHADE = getColor("ZINC", 950);

/** Draws a sprite centred on a point, turned to `heading` and its span scaled by `fold`. */
export function stamp(
  drawing: CanvasRenderingContext2D,
  sprite: p5.Graphics,
  x: number,
  y: number,
  heading: number,
  half: number,
  fold: number
) {
  drawing.save();
  drawing.translate(x, y);
  drawing.rotate(heading);
  drawing.scale(1, fold);
  drawing.drawImage(sprite.elt, -half, -half, half * 2, half * 2);
  drawing.restore();
}

/** A square sprite `half` pixels each way from its centre, its origin at the centre. */
export function spriteOf(sketch: p5, half: number) {
  const sprite = sketch.createGraphics(
    Math.ceil(half * 2),
    Math.ceil(half * 2)
  );
  sprite.translate(half, half);
  sprite.noStroke();
  return sprite;
}

/**
 * Paints whatever `paint` draws as its soft shadow alone: the shapes go far
 * off the sprite and the canvas shadow, offset back by as much, lands in it.
 */
export function shadowOnly(
  sprite: p5.Graphics,
  blur: number,
  opacity: number,
  paint: () => void
) {
  const drawing = context(sprite);
  if (!drawing) {
    return;
  }
  const far = sprite.width * 4;
  const density = sprite.pixelDensity();
  sprite.push();
  drawing.shadowColor = fade(SHADE, opacity);
  drawing.shadowBlur = blur * density;
  drawing.shadowOffsetX = far * density;
  sprite.translate(-far, 0);
  sprite.fill(SHADE);
  paint();
  sprite.pop();
}

/**
 * Lights what the sprite already holds with a gradient: `source-atop` keeps
 * the gradient inside the painted shape, so a flat silhouette reads as a
 * rounded body.
 */
export function lightInside(
  sprite: p5.Graphics,
  paint: (drawing: CanvasRenderingContext2D) => void
) {
  const drawing = context(sprite);
  if (!drawing) {
    return;
  }
  drawing.save();
  drawing.globalCompositeOperation = "source-atop";
  paint(drawing);
  drawing.restore();
}
