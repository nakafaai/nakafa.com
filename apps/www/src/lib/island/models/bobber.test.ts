// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { bobberFaces } from "@/lib/island/models/bobber";
import { boundsOf, flatten, MODEL_STRIDE } from "@/lib/island/models/parts";

describe("island/models/bobber", () => {
  it("floats about the water's face, its quill standing over it", () => {
    const { x, y, z } = boundsOf(bobberFaces());
    expect(y[0]).toBeLessThan(0);
    expect(y[1]).toBeGreaterThan(-y[0]);
    expect(Math.abs(x[0] + x[1])).toBeLessThan(0.01);
    expect(Math.abs(z[0] + z[1])).toBeLessThan(0.01);
  });

  it("is drawn as whole triangles", () => {
    const corners = flatten(bobberFaces());
    expect(corners.length).toBeGreaterThan(0);
    expect(corners.length % (3 * MODEL_STRIDE)).toBe(0);
  });
});
