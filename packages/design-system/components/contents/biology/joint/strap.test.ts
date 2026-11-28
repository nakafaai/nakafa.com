import { describe, expect, it } from "@effect/vitest";
import {
  bulge,
  stretchBetween,
} from "@repo/design-system/components/contents/biology/joint/strap";
import { Object3D, Vector3 } from "three";

describe("stretchBetween", () => {
  it("lays a unit part from one place to another at its girth", () => {
    const part = new Object3D();

    stretchBetween(part, new Vector3(1, 1, 0), new Vector3(1, 3, 0), 0.5);

    expect(part.position.toArray()).toEqual([1, 1, 0]);
    expect(part.scale.toArray()).toEqual([2, 0.5, 0.5]);
    const tip = new Vector3(1, 0, 0).applyQuaternion(part.quaternion);
    expect(tip.x).toBeCloseTo(0);
    expect(tip.y).toBeCloseTo(1);
    expect(tip.z).toBeCloseTo(0);
  });
});

describe("bulge", () => {
  it("keeps a muscle's volume: half as long is the square root of two thicker", () => {
    expect(bulge(0.1, 1, 1)).toBeCloseTo(0.1);
    expect(bulge(0.1, 1, 0.5)).toBeCloseTo(0.1 * Math.SQRT2);
  });
});
