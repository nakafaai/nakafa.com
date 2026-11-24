// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { poseOf } from "@repo/design-system/components/contents/mathematics/counterexample/pose";

const HOME = { x: 0.1, z: -0.05 };

describe("how a tile lies during the check", () => {
  it("lies flat and plain before its check", () => {
    expect(
      poseOf({
        checked: 0,
        from: HOME,
        held: false,
        scanning: false,
        to: HOME,
        verdict: "breaks",
      })
    ).toEqual({ dim: 0, lift: 0, spot: 0, tilt: 0, x: 0.1, z: -0.05 });
  });

  it("stands a checked counterexample or example up, and darkens a tile outside the claim", () => {
    const breaks = poseOf({
      checked: 1,
      from: HOME,
      held: false,
      scanning: false,
      to: HOME,
      verdict: "breaks",
    });
    expect(breaks.tilt).toBeGreaterThan(0);
    expect(breaks.lift).toBeGreaterThan(0);
    expect(breaks.spot).toBe(1);
    expect(breaks.dim).toBe(0);
    const proves = poseOf({
      checked: 1,
      from: HOME,
      held: false,
      scanning: false,
      to: HOME,
      verdict: "proves",
    });
    expect(proves.tilt).toBe(breaks.tilt);
    const outside = poseOf({
      checked: 1,
      from: HOME,
      held: false,
      scanning: false,
      to: HOME,
      verdict: "outside",
    });
    expect(outside).toEqual({
      dim: 1,
      lift: 0,
      spot: 1,
      tilt: 0,
      x: 0.1,
      z: -0.05,
    });
    expect(
      poseOf({
        checked: 0.5,
        from: HOME,
        held: false,
        scanning: false,
        to: HOME,
        verdict: "safe",
      }).dim
    ).toBe(0.5);
  });

  it("carries a checked tile to its cell on the case board", () => {
    const cell = { x: -0.2, z: 0.15 };
    const halfway = poseOf({
      checked: 0.5,
      from: HOME,
      held: false,
      scanning: false,
      to: cell,
      verdict: "fits",
    });
    expect(halfway.x).toBeCloseTo(-0.05);
    expect(halfway.lift).toBeGreaterThan(0);
    expect(halfway.tilt).toBe(0);
    const there = poseOf({
      checked: 1,
      from: HOME,
      held: false,
      scanning: false,
      to: cell,
      verdict: "fits",
    });
    expect(there.x).toBeCloseTo(-0.2);
    expect(there.z).toBeCloseTo(0.15);
  });

  it("holds a picked tile up to the camera above every other tile", () => {
    const held = poseOf({
      checked: 1,
      from: HOME,
      held: true,
      scanning: false,
      to: HOME,
      verdict: "breaks",
    });
    const standing = poseOf({
      checked: 1,
      from: HOME,
      held: false,
      scanning: false,
      to: HOME,
      verdict: "breaks",
    });
    expect(held.lift).toBeGreaterThan(standing.lift);
    expect(held.tilt).toBeGreaterThan(standing.tilt);
    expect(held.spot).toBe(1);
  });

  it("lifts the tile being checked a little while the answer stays hidden", () => {
    const scanned = poseOf({
      checked: 0,
      from: HOME,
      held: false,
      scanning: true,
      to: HOME,
      verdict: "breaks",
    });
    expect(scanned.lift).toBeGreaterThan(0);
    expect(scanned.tilt).toBe(0);
    expect(scanned.spot).toBe(0);
  });
});
