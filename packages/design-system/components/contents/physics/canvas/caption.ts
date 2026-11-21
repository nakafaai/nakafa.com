import type p5 from "p5";

/**
 * Writes a short caption on a sketch's canvas, such as a symbol beside a
 * mark or a distance on a bar. Nakafa loads p5's core without its
 * typography module, so the caption goes straight to the canvas's 2D
 * context, in the page's sans-serif face.
 */
export function caption(
  sketch: p5,
  words: string,
  at: { readonly x: number; readonly y: number },
  style: {
    readonly align: CanvasTextAlign;
    readonly baseline: CanvasTextBaseline;
    readonly color: string;
    readonly size: number;
  }
) {
  const drawing = sketch.drawingContext;
  if (!(drawing instanceof CanvasRenderingContext2D)) {
    return;
  }
  drawing.save();
  drawing.font = `500 ${style.size}px Allo, system-ui, sans-serif`;
  drawing.fillStyle = style.color;
  drawing.textAlign = style.align;
  drawing.textBaseline = style.baseline;
  drawing.fillText(words, at.x, at.y);
  drawing.restore();
}
