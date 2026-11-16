import {
  fade,
  gradientRect,
  mix,
  spotlight,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { getColor } from "@repo/design-system/lib/color";
import { MATERIAL } from "@repo/design-system/lib/material";
import { Schema } from "effect";
import type p5 from "p5";

/**
 * Painting for the light labs: a darkened optics room, a laser or ray-box
 * beam that glows the way a real beam does in faint haze, glass that shows
 * its edges, and the arcs that mark an angle between a ray and a normal.
 */

/** A point on the canvas, in pixels. */
const PointSchema = Schema.Struct({ x: Schema.Finite, y: Schema.Finite });
export type Point = typeof PointSchema.Type;

/** The darkened room of an optics bench: a black wall with one soft pool of light. */
export function paintDarkRoom(sketch: p5) {
  const { height, width } = sketch;
  gradientRect(sketch, { height, width, x: 0, y: 0 }, [
    [0, mix(getColor("ZINC", 900), getColor("SLATE", 800), 0.3)],
    [1, getColor("ZINC", 950)],
  ]);
  spotlight(sketch, { x: width * 0.5, y: height * 0.35 }, width * 0.7, {
    color: getColor("SLATE", 400),
    strength: 0.18,
  });
}

/** The matt black top of an optics bench across the bottom of the frame, from `top` down. */
export function paintBenchTop(sketch: p5, top: number) {
  gradientRect(
    sketch,
    { height: sketch.height - top, width: sketch.width, x: 0, y: top },
    [
      [0, getColor("NEUTRAL", 700)],
      [0.08, getColor("NEUTRAL", 800)],
      [1, getColor("ZINC", 950)],
    ]
  );
}

/**
 * Draws a beam from `from` to `to` as a bright core inside a soft halo, so it
 * reads as light rather than a drawn line. `strength` dims a weak beam, such
 * as the part of a ray that reflects off a surface it mostly crosses.
 */
export function beam(
  sketch: p5,
  from: Point,
  to: Point,
  color: string,
  strength = 1
) {
  sketch.push();
  sketch.strokeCap(sketch.ROUND);
  sketch.stroke(fade(color, 0.12 * strength));
  sketch.strokeWeight(14);
  sketch.line(from.x, from.y, to.x, to.y);
  sketch.stroke(fade(color, 0.3 * strength));
  sketch.strokeWeight(6);
  sketch.line(from.x, from.y, to.x, to.y);
  sketch.stroke(fade(mix(color, getColor("WHITE"), 0.55), strength));
  sketch.strokeWeight(2);
  sketch.line(from.x, from.y, to.x, to.y);
  sketch.pop();
}

/**
 * Fills a rectangle of glass: a faint blue-green body that darkens toward its
 * far edges, a bright rim where the edges catch the light, and a sheen across
 * its upper face.
 */
export function paintGlass(
  sketch: p5,
  box: {
    readonly height: number;
    readonly width: number;
    readonly x: number;
    readonly y: number;
  }
) {
  const tint = MATERIAL.glass;
  gradientRect(
    sketch,
    box,
    [
      [0, fade(tint, 0.16)],
      [0.5, fade(tint, 0.07)],
      [1, fade(tint, 0.2)],
    ],
    true
  );
  gradientRect(sketch, { ...box, height: box.height * 0.18 }, [
    [0, fade(getColor("WHITE"), 0.16)],
    [1, fade(getColor("WHITE"), 0)],
  ]);
  sketch.push();
  sketch.noFill();
  sketch.stroke(fade(mix(tint, getColor("WHITE"), 0.6), 0.75));
  sketch.strokeWeight(2);
  sketch.rect(box.x, box.y, box.width, box.height, 2);
  sketch.pop();
}

/** Draws the arc of an angle at `center` from direction `start` to direction `end`, in radians on the canvas. */
export function angleArc(
  sketch: p5,
  center: Point,
  radius: number,
  angles: { readonly end: number; readonly start: number },
  color: string
) {
  sketch.push();
  sketch.noFill();
  sketch.stroke(color);
  sketch.strokeWeight(2.5);
  sketch.arc(
    center.x,
    center.y,
    radius * 2,
    radius * 2,
    Math.min(angles.start, angles.end),
    Math.max(angles.start, angles.end)
  );
  sketch.pop();
}

/** A ray box: a black lamp housing with a slit, aimed along `angle` radians with its slit at `at`. */
export function paintRayBox(
  sketch: p5,
  at: Point,
  angle: number,
  size: number
) {
  sketch.push();
  sketch.translate(at.x, at.y);
  sketch.rotate(angle);
  sketch.noStroke();
  sketch.fill(getColor("NEUTRAL", 800));
  sketch.rect(-size * 2.2, -size * 0.55, size * 2.2, size * 1.1, size * 0.18);
  sketch.fill(fade(getColor("WHITE"), 0.12));
  sketch.rect(-size * 2.2, -size * 0.55, size * 2.2, size * 0.25, size * 0.18);
  sketch.fill(getColor("ZINC", 950));
  sketch.rect(-size * 0.12, -size * 0.3, size * 0.12, size * 0.6);
  sketch.fill(fade(MATERIAL.lampLight, 0.9));
  sketch.rect(-size * 0.06, -size * 0.07, size * 0.06, size * 0.14);
  sketch.pop();
}
