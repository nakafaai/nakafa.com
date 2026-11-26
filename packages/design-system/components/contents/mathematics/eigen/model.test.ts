import { describe, expect, it } from "@effect/vitest";
import { evaluateEigenTransform } from "@repo/design-system/components/contents/mathematics/eigen/model";

describe("eigen transform 3D model", () => {
  it("interpolates from identity to target eigenvalues and determinant across all presets", () => {
    const start = evaluateEigenTransform("symmetricDiag", 0);
    const diag = evaluateEigenTransform("symmetricDiag", 1);
    const shear = evaluateEigenTransform("stretchShear", 1);
    const reflect = evaluateEigenTransform("reflectionScale", 1);
    const aniso = evaluateEigenTransform("anisotropic3D", 1);

    expect(start.determinant).toBe(1);
    expect(diag.determinant).toBeCloseTo(1.49, 2);
    expect(shear.shearXY).toBeGreaterThan(0);
    expect(reflect.determinant).toBeLessThan(0);
    expect(aniso.scaleX).toBeGreaterThan(aniso.scaleY);
  });
});
