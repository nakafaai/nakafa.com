// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import {
  invert,
  lookAt,
  multiply,
  normalize,
  orthographic,
  perspective,
  rayThrough,
  viewProjectionOf,
} from "@/lib/island/matrix";

/** A camera a little turned, looking down at a place of the land as the game's does. */
const ORBIT = {
  distance: 40,
  pitch: 0.7,
  target: [32, 9, -12] as const,
  yaw: 0.6,
};

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

  it("squeezes the box a sun sees into clip space, its near face at -1 and its far face at 1", () => {
    // Sides that are powers of two, which a matrix of single floats holds exactly.
    const box = orthographic(16, 1, 65);
    const clipOf = (x: number, y: number, z: number) =>
      Arr.map(
        [0, 1, 2, 3],
        (row) =>
          box[row] * x + box[4 + row] * y + box[8 + row] * z + box[12 + row]
      );
    expect(clipOf(16, -16, -1)).toEqual([1, -1, -1, 1]);
    expect(clipOf(-8, 4, -65)).toEqual([-0.5, 0.25, 1, 1]);
    expect(clipOf(0, 0, -33)[2]).toBe(0);
  });

  it("looks from the eye at the target, which lands in the middle of the screen", () => {
    const orbit = ORBIT;
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
    const orbit = ORBIT;
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

  it("widens the view by a lens, for a frame drawn past the screen's edges", () => {
    const orbit = ORBIT;
    const plain = viewProjectionOf(orbit, 1.5);
    const wide = viewProjectionOf(orbit, 1.5, 1.1);
    // A wider view draws the same world smaller: the projection's vertical scale shrinks by the lens.
    expect(wide[5] / plain[5]).toBeCloseTo(1 / 1.1, 4);
  });
});
