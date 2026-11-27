import { describe, expect, it } from "@effect/vitest";
import { boxWrap } from "@repo/design-system/components/contents/biology/climate/wrap";

describe("boxWrap", () => {
  it("lays each vertex flat on the face of the box its normal leans toward", () => {
    const places = [1, 2, 3, 1, 2, 3, 1, 2, 3];
    const normals = [0.9, 0.1, -0.2, 0.1, -0.8, 0.3, 0.2, 0.3, 0.7];

    expect([...boxWrap(places, normals, 2)]).toEqual([6, 4, 2, 6, 2, 4]);
  });

  it("answers one pair for every whole vertex", () => {
    expect(boxWrap([0, 0, 0, 5], [0, 1, 0, 5], 1)).toHaveLength(2);
  });
});
