import { describe, expect, it } from "@effect/vitest";
import type { Stroke } from "@repo/design-system/components/three/organism/life";
import {
  breathAt,
  strokeInto,
} from "@repo/design-system/components/three/organism/life";

/** A tail that beats up and down from the middle of the body to x = -1. */
const TAIL: Stroke = { axis: 1, from: 0, reach: 0.2, to: -1, turns: 0 };

describe("strokeInto", () => {
  it("holds the head still and swings the tail tip the full reach", () => {
    const rest = Float32Array.from([0.5, 0, 0, -0.5, 0, 0, -1, 0, 0, -2, 0, 0]);
    const live = Float32Array.from(rest);

    strokeInto(rest, live, TAIL, Math.PI / 2);

    expect(live[1]).toBe(0);
    expect(live[4]).toBeCloseTo(0.05);
    expect(live[7]).toBeCloseTo(0.2);
    expect(live[10]).toBeCloseTo(0.2);
    expect(live[0]).toBe(0.5);
    expect(rest[7]).toBe(0);
  });

  it("carries a wave down the body so the tip lags the root", () => {
    const rest = Float32Array.from([-1, 0, 0]);
    const live = Float32Array.from(rest);

    strokeInto(rest, live, { ...TAIL, axis: 2, turns: 0.25 }, Math.PI / 2);

    expect(live[2]).toBeCloseTo(0);
    expect(live[1]).toBe(0);
  });
});

describe("breathAt", () => {
  it("swells from rest to its full depth and back", () => {
    expect(breathAt(-Math.PI / 2, 0.2)).toBeCloseTo(1);
    expect(breathAt(Math.PI / 2, 0.2)).toBeCloseTo(1.2);
    expect(breathAt(0, 0.2)).toBeCloseTo(1.1);
  });
});
