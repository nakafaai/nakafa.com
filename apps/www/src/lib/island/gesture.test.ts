// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import {
  distanceOf,
  isTap,
  pinchOf,
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
  });
});
