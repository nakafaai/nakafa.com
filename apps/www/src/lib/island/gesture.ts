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

/** The zoom a wheel turn of `deltaY` asks for: each notch of 100 brings the camera 13% closer or farther, capped for a hard flick. */
export function wheelZoomOf(deltaY: number) {
  return Math.exp(Math.max(-300, Math.min(300, deltaY)) * 0.0014);
}

/** How far a press must move, in CSS pixels, before it turns the world: a mouse is steady, a finger wobbles. */
export const DRAG = { mouse: 5, touch: 10 } as const;

/** How fast a drag turns the world, in radians a second, as it was last measured (`at`, in milliseconds). */
export const Spin = Schema.Struct({
  at: Schema.Finite,
  pitch: Schema.Finite,
  yaw: Schema.Finite,
});
export type Spin = typeof Spin.Type;

/** A world at rest. */
export const STILL_SPIN: Spin = { at: 0, pitch: 0, yaw: 0 };

/** How long a spin takes to fade to a third of its speed, in seconds. */
const SPIN_FADE = 0.15;

/** A drag held still this long, in milliseconds, before it lifts leaves the world at rest. */
const SPIN_REST = 60;

/** The share of a new measure in the spin, so one jumpy event never flings the world. */
const SPIN_BLEND = 0.6;

/** The spin after a drag turned the world by `yaw` and `pitch` radians at `now` milliseconds. */
export function followSpin(
  spin: Spin,
  yaw: number,
  pitch: number,
  now: number
): Spin {
  const seconds = (now - spin.at) / 1000;
  if (spin.at === 0 || seconds <= 0 || seconds > SPIN_REST / 1000) {
    return { at: now, pitch: 0, yaw: 0 };
  }
  const mix = (last: number, measured: number) =>
    last + (measured - last) * SPIN_BLEND;
  return {
    at: now,
    pitch: mix(spin.pitch, pitch / seconds),
    yaw: mix(spin.yaw, yaw / seconds),
  };
}

/** The spin a drag hands on when it lifts at `now`: none if it rested before lifting. */
export function releaseSpin(spin: Spin, now: number): Spin {
  return now - spin.at > SPIN_REST ? STILL_SPIN : spin;
}

/** The spin after `seconds` more of fading. */
export function fadeSpin(spin: Spin, seconds: number): Spin {
  const kept = Math.exp(-Math.max(0, seconds) / SPIN_FADE);
  return { ...spin, pitch: spin.pitch * kept, yaw: spin.yaw * kept };
}

/** Whether a spin still turns the world visibly. */
export function isSpinning(spin: Spin) {
  return Math.abs(spin.yaw) > 0.02 || Math.abs(spin.pitch) > 0.02;
}
