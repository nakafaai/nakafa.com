import { describe, expect, it } from "@effect/vitest";
import {
  createPath,
  createQuadraticPath,
} from "@repo/design-system/components/contents/chemistry/path";
import { Array as Arr } from "effect";
import { Vector3 } from "three";

describe("createPath", () => {
  it("samples progress from zero at the first point to one at the last", () => {
    const points = createPath(3, (progress) => new Vector3(progress, 0, 0));

    expect(Arr.map(points, (point) => point.x)).toStrictEqual([0, 0.5, 1]);
  });
});

describe("createQuadraticPath", () => {
  it("starts at the start, ends at the end, and bends toward the control point", () => {
    const points = createQuadraticPath(
      3,
      new Vector3(0, 0, 0),
      new Vector3(1, 2, 0),
      new Vector3(2, 0, 0)
    );

    expect(Arr.map(points, (point) => [point.x, point.y])).toStrictEqual([
      [0, 0],
      [1, 1],
      [2, 0],
    ]);
  });
});
