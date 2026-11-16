// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import type { Orbit } from "@/lib/island/camera";
import { SHADOW_SIZE, sunViewOf } from "@/lib/island/sun";

/** Where a world point falls in the light's box, from -1 to 1 on each axis. */
function placeOf(
  matrix: Float32Array,
  point: readonly [number, number, number]
) {
  const row = (index: number) =>
    matrix[index] * point[0] +
    matrix[4 + index] * point[1] +
    matrix[8 + index] * point[2] +
    matrix[12 + index];
  return [row(0), row(1), row(2)] as const;
}

const NOON = [-0.37, 0.866, 0.33] as const;

const ORBIT: Orbit = {
  distance: 40,
  pitch: 0.8,
  target: [64, 9, 64],
  yaw: 0.6,
};

describe("island/sun", () => {
  it("looks along the light at the camera's target, nearer for what stands toward the sun", () => {
    const matrix = sunViewOf(ORBIT, NOON).matrix;
    const middle = placeOf(matrix, ORBIT.target);
    const texel = 2 / SHADOW_SIZE;
    expect(Math.abs(middle[0])).toBeLessThanOrEqual(texel);
    expect(Math.abs(middle[1])).toBeLessThanOrEqual(texel);
    const raised = placeOf(matrix, [
      ORBIT.target[0] + NOON[0] * 5,
      ORBIT.target[1] + NOON[1] * 5,
      ORBIT.target[2] + NOON[2] * 5,
    ]);
    expect(raised[2]).toBeLessThan(middle[2]);
  });

  it("moves its box in whole texels, so a small pan leaves a shadow's edge where it was", () => {
    const point = [70, 9, 61] as const;
    const before = placeOf(sunViewOf(ORBIT, NOON).matrix, point);
    const after = placeOf(
      sunViewOf({ ...ORBIT, target: [64.003, 9, 64.002] }, NOON).matrix,
      point
    );
    const texel = 2 / SHADOW_SIZE;
    const steps = (after[0] - before[0]) / texel;
    expect(Math.abs(steps - Math.round(steps))).toBeLessThan(0.01);
    expect(after[1]).toBeCloseTo(before[1], 4);
  });

  it("covers more ground the farther the camera stands", () => {
    const point = [64 + 45, 9, 64] as const;
    const near = placeOf(
      sunViewOf({ ...ORBIT, distance: 12 }, NOON).matrix,
      point
    );
    const far = placeOf(
      sunViewOf({ ...ORBIT, distance: 90 }, NOON).matrix,
      point
    );
    expect(Math.max(Math.abs(near[0]), Math.abs(near[1]))).toBeGreaterThan(1);
    expect(Math.max(Math.abs(far[0]), Math.abs(far[1]))).toBeLessThan(1);
    expect(sunViewOf({ ...ORBIT, distance: 90 }, NOON).texel).toBeGreaterThan(
      sunViewOf({ ...ORBIT, distance: 12 }, NOON).texel
    );
  });
});
