// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Option } from "effect";
import { openingOrbit } from "@/lib/island/camera";
import {
  groundThrough,
  invert,
  lookAt,
  multiply,
  normalize,
  perspective,
  rayThrough,
  viewProjectionOf,
} from "@/lib/island/matrix";

const IDENTITY = new Float32Array([
  1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
]);

describe("island/matrix", () => {
  it("inverts a camera so that it undoes itself", () => {
    const matrix = multiply(
      perspective(0.6, 1.5, 0.5, 400),
      lookAt([10, 20, 30], [32, 9, 32])
    );
    const product = multiply(matrix, invert(matrix));
    Arr.forEach(
      Arr.makeBy(16, (index) => index),
      (index) => {
        expect(product[index]).toBeCloseTo(IDENTITY[index], 4);
      }
    );
    expect(invert(new Float32Array(16))).toEqual(new Float32Array(16));
  });

  it("looks from the eye at the target, which lands in the middle of the screen", () => {
    const orbit = openingOrbit(24, 1.5);
    const clip = viewProjectionOf(orbit, 1);
    const [x, y, , w] = Arr.map(
      [0, 1, 2, 3],
      (row) =>
        clip[row] * orbit.target[0] +
        clip[4 + row] * orbit.target[1] +
        clip[8 + row] * orbit.target[2] +
        clip[12 + row]
    );
    expect(x / w).toBeCloseTo(0, 4);
    expect(y / w).toBeCloseTo(0, 4);
  });

  it("casts the middle of the screen straight at the target", () => {
    const orbit = openingOrbit(24, 1.5);
    const ray = rayThrough(orbit, 1.5, 0, 0);
    const toTarget = normalize([
      orbit.target[0] - ray.origin[0],
      orbit.target[1] - ray.origin[1],
      orbit.target[2] - ray.origin[2],
    ]);
    expect(ray.direction[0]).toBeCloseTo(toTarget[0], 4);
    expect(ray.direction[1]).toBeCloseTo(toTarget[1], 4);
    expect(normalize([0, 0, 0])).toEqual([0, 0, 0]);
  });

  it("finds the ground under a point of the screen at the target's level, and none above the horizon", () => {
    const orbit = openingOrbit(24, 1.5);
    const middle = Option.getOrThrow(groundThrough(orbit, 1.5, 0, 0));
    expect(middle[0]).toBeCloseTo(orbit.target[0], 3);
    expect(middle[1]).toBe(orbit.target[1]);
    expect(middle[2]).toBeCloseTo(orbit.target[2], 3);
    const level = { ...orbit, pitch: 0.05 };
    expect(Option.isNone(groundThrough(level, 1.5, 0, 1))).toBe(true);
  });

  it("widens the view by a lens, for a frame drawn past the screen's edges", () => {
    const orbit = openingOrbit(24, 1.5);
    const plain = viewProjectionOf(orbit, 1.5);
    const wide = viewProjectionOf(orbit, 1.5, 1.1);
    // A wider view draws the same world smaller: the projection's vertical scale shrinks by the lens.
    expect(wide[5] / plain[5]).toBeCloseTo(1 / 1.1, 4);
  });
});
