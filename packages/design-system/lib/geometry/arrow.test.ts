import { describe, expect, it } from "@effect/vitest";

import { resolveArrowSize } from "@repo/design-system/lib/geometry/arrow";

describe("arrow geometry", () => {
  it("preserves the requested size on a long terminal segment", () => {
    expect(
      resolveArrowSize(
        [
          { x: 0, y: 0, z: 0 },
          { x: 10, y: 0, z: 0 },
        ],
        1,
        "end"
      )
    ).toBe(1);
  });

  it("scales both cones so a near-corner segment cannot reverse", () => {
    expect(
      resolveArrowSize(
        [
          { x: 0, y: 0, z: 0 },
          { x: 0.03, y: 0, z: 0 },
        ],
        1,
        "both"
      )
    ).toBeCloseTo(0.01, 12);
  });

  it("omits cones for an exact-corner marker", () => {
    expect(
      resolveArrowSize(
        [
          { x: 1, y: 1, z: 1 },
          { x: 1, y: 1, z: 1 },
        ],
        1,
        "end"
      )
    ).toBe(0);
  });

  it("omits cones when a terminal segment or requested size is absent", () => {
    expect(resolveArrowSize([], 1, "start")).toBe(0);
    expect(
      resolveArrowSize(
        [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
        ],
        0,
        "start"
      )
    ).toBe(0);
  });

  it("bounds a start cone and rejects an overflowing terminal distance", () => {
    expect(
      resolveArrowSize(
        [
          { x: 0, y: 0, z: 0 },
          { x: 0.1, y: 0, z: 0 },
          { x: 10, y: 0, z: 0 },
        ],
        1,
        "start"
      )
    ).toBeCloseTo(0.05, 12);
    expect(
      resolveArrowSize(
        [
          { x: -1e308, y: 0, z: 0 },
          { x: 1e308, y: 0, z: 0 },
        ],
        1,
        "end"
      )
    ).toBe(0);
  });

  it("caps both ends independently on a polyline", () => {
    expect(
      resolveArrowSize(
        [
          { x: 0, y: 0, z: 0 },
          { x: 0.2, y: 0, z: 0 },
          { x: 0.2, y: 1, z: 0 },
          { x: 0.3, y: 1, z: 0 },
        ],
        1,
        "both"
      )
    ).toBeCloseTo(0.05, 12);
  });
});
