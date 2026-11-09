// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import { openingOrbit } from "@/lib/island/camera";
import {
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
});
