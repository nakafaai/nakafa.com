// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import {
  DRAG,
  distanceOf,
  fadeSpin,
  followSpin,
  isSpinning,
  isTap,
  pinchOf,
  releaseSpin,
  STILL_SPIN,
  TAP,
  wheelZoomOf,
} from "@/lib/island/gesture";

describe("island/gesture", () => {
  it("takes a short still press as a tap and anything longer or farther as a drag", () => {
    expect(isTap(0, 80)).toBe(true);
    expect(isTap(TAP.slop, 80)).toBe(false);
    expect(isTap(2, TAP.held)).toBe(false);
  });

  it("reads a spread as coming closer, a turn as a twist, and a slide as a pan", () => {
    const pinch = pinchOf(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      [
        { x: 10, y: 10 },
        { x: 10, y: 210 },
      ]
    );
    expect(pinch.zoom).toBeCloseTo(0.5);
    expect(pinch.twist).toBeCloseTo(Math.PI / 2);
    expect(pinch.dx).toBe(-40);
    expect(pinch.dy).toBe(110);
    expect(distanceOf({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it("turns the wheel into a gentle zoom, capped for a hard flick", () => {
    expect(wheelZoomOf(0)).toBe(1);
    expect(wheelZoomOf(100)).toBeGreaterThan(1);
    expect(wheelZoomOf(-100)).toBeLessThan(1);
    expect(wheelZoomOf(10_000)).toBe(wheelZoomOf(300));
    expect(wheelZoomOf(100)).toBeCloseTo(Math.exp(0.14));
  });

  it("lets a finger wobble farther than a mouse before a press turns the world", () => {
    expect(DRAG.touch).toBeGreaterThan(DRAG.mouse);
  });

  it("measures a drag's turn, blends a jumpy event in, and lets it spin on only if it was still moving when it lifted", () => {
    const first = followSpin(STILL_SPIN, 0.1, 0, 1000);
    expect(first.yaw).toBe(0);
    const moving = followSpin(first, 0.1, 0.05, 1016);
    // A tenth of a radian in 16 ms is 6.25 rad/s, of which the blend takes 60%.
    expect(moving.yaw).toBeCloseTo(6.25 * 0.6);
    expect(moving.pitch).toBeCloseTo(3.125 * 0.6);
    expect(releaseSpin(moving, 1040)).toBe(moving);
    expect(releaseSpin(moving, 1100)).toBe(STILL_SPIN);
    expect(followSpin(moving, 0.1, 0, 1200).yaw).toBe(0);
  });

  it("fades a spin to a third of its speed in 0.15 s, until it no longer shows", () => {
    const spin = { at: 0, pitch: 1, yaw: 3 };
    expect(fadeSpin(spin, 0.15).yaw).toBeCloseTo(3 / Math.E);
    expect(isSpinning(spin)).toBe(true);
    expect(isSpinning(fadeSpin(spin, 2))).toBe(false);
    expect(fadeSpin(spin, -1).yaw).toBe(3);
  });
});
