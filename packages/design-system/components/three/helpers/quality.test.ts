// @vitest-environment node
import {
  createArcPoints,
  getCurveDivisions,
} from "@repo/design-system/components/three/helpers/quality";
import { describe, expect, it } from "vitest";

describe("graph quality helpers", () => {
  it("uses requested curve divisions when provided", () => {
    expect(getCurveDivisions(12, 8)).toBe(8);
    expect(getCurveDivisions(12, 0)).toBe(1);
  });

  it("does not add curve divisions for point sets without a segment", () => {
    expect(getCurveDivisions(1)).toBe(0);
  });

  it("keeps sparse curves smooth without resampling dense curves down", () => {
    expect(getCurveDivisions(12)).toBe(64);
    expect(getCurveDivisions(100)).toBe(99);
  });

  it("creates XY-plane arc points from radians", () => {
    const points = createArcPoints(4, Math.PI / 2, 2);

    expect(points).toHaveLength(3);
    expect(points[0]?.x).toBeCloseTo(4, 12);
    expect(points[0]?.y).toBeCloseTo(0, 12);
    expect(points[1]?.x).toBeCloseTo(Math.sqrt(8), 12);
    expect(points[1]?.y).toBeCloseTo(Math.sqrt(8), 12);
    expect(points[2]?.x).toBeCloseTo(0, 12);
    expect(points[2]?.y).toBeCloseTo(4, 12);
    expect(points.every((point) => point.z === 0)).toBe(true);
  });

  it("creates at least one segment for invalid arc segment counts", () => {
    expect(createArcPoints(4, Math.PI, 0)).toHaveLength(2);
  });
});
