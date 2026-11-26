import { describe, expect, it } from "@effect/vitest";
import {
  evaluateDotProjection,
  presetDotAngle,
} from "@repo/design-system/components/contents/mathematics/projection/model";

describe("dot product projection 3D model", () => {
  it("computes positive, zero, and negative projections across acute, orthogonal, and obtuse presets", () => {
    const acute = evaluateDotProjection(presetDotAngle("acute"));
    const ortho = evaluateDotProjection(presetDotAngle("orthogonal"));
    const obtuse = evaluateDotProjection(presetDotAngle("obtuse"));

    expect(acute.dotProduct).toBeGreaterThan(0);
    expect(ortho.dotProduct).toBe(0);
    expect(obtuse.dotProduct).toBeLessThan(0);
    expect(obtuse.projectionLength).toBeLessThan(0);
  });
});
