import { Schema } from "effect";

/** A pointer's position on the screen, in CSS pixels. */
export const Point = Schema.Struct({ x: Schema.Finite, y: Schema.Finite });
export type Point = typeof Point.Type;

/**
 * One pointer pressed on the world while it lasts: where and when it started,
 * which button, where it is now, the farthest it has wandered, and whether a
 * long press already used it.
 */
export const Press = Schema.Struct({
  at: Schema.Finite,
  button: Schema.Int,
  last: Point,
  moved: Schema.Finite,
  start: Point,
  used: Schema.Boolean,
});
export type Press = typeof Press.Type;

/** How far a press may wander, in CSS pixels, and how long it may last, in milliseconds, and still be a tap (ADR 0047, D5). */
export const TAP = { held: 350, slop: 8 } as const;

/** How long a still press must last to remove the block under it. */
export const LONG_PRESS = 450;

/** Whether a press that moved this far and lasted this long is a tap. */
export function isTap(moved: number, held: number) {
  return moved < TAP.slop && held < TAP.held;
}

/** The distance between two points. */
export function distanceOf(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * What two fingers did between two moments: how much closer the camera should
 * come (`zoom`, under 1 when they spread), how far they turned (`twist`, in
 * radians), and how far their middle moved (`dx`, `dy`).
 */
export function pinchOf(
  before: readonly [Point, Point],
  after: readonly [Point, Point]
) {
  const spanBefore = Math.max(1, distanceOf(before[0], before[1]));
  const spanAfter = Math.max(1, distanceOf(after[0], after[1]));
  const angle = (pair: readonly [Point, Point]) =>
    Math.atan2(pair[1].y - pair[0].y, pair[1].x - pair[0].x);
  const raw = angle(after) - angle(before);
  return {
    dx: (after[0].x + after[1].x - before[0].x - before[1].x) / 2,
    dy: (after[0].y + after[1].y - before[0].y - before[1].y) / 2,
    twist: Math.atan2(Math.sin(raw), Math.cos(raw)),
    zoom: spanBefore / spanAfter,
  };
}

/** The zoom a wheel turn of `deltaY` asks for: each notch of 100 brings the camera 15% closer or farther. */
export function wheelZoomOf(deltaY: number) {
  return Math.exp(Math.max(-3, Math.min(3, deltaY / 100)) * 0.15);
}
