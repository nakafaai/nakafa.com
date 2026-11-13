import { describe, expect, it } from "@effect/vitest";
import {
  CoursesSchema,
  courseParts,
  voyageCorners,
  voyageDisplacement,
  voyagePoint,
} from "@repo/design-system/components/contents/physics/vector/bearing/voyage";
import { Schema } from "effect";

describe("courseParts", () => {
  it("splits 10 km on a bearing of 30° into 5 km east and 8.66 km north", () => {
    const parts = courseParts({ bearing: 30, distance: 10 });
    expect(parts.east).toBeCloseTo(5, 10);
    expect(parts.north).toBeCloseTo(8.660_254, 6);
  });

  it("gives both components negative signs on a bearing of 225°", () => {
    const parts = courseParts({ bearing: 225, distance: 10 });
    expect(parts.east).toBeLessThan(0);
    expect(parts.north).toBeLessThan(0);
  });
});

describe("voyageDisplacement", () => {
  const voyage = Schema.decodeSync(CoursesSchema)([
    { bearing: 90, distance: 6 },
    { bearing: 0, distance: 8 },
  ]);

  it("adds 6 km east and 8 km north into 10 km on 36.87°", () => {
    const moved = voyageDisplacement(voyage);
    expect(moved.size).toBeCloseTo(10, 10);
    expect(moved.bearing).toBeCloseTo(36.87, 2);
    expect(moved.path).toBe(14);
  });

  it("is zero, with a bearing of zero, after sailing out and back", () => {
    const moved = voyageDisplacement([
      { bearing: 90, distance: 5 },
      { bearing: 270, distance: 5 },
    ]);
    expect(moved.size).toBeCloseTo(0, 10);
    expect(moved.bearing).toBe(0);
  });

  it("reads a bearing past 180° for a ship that ends south-west", () => {
    expect(
      voyageDisplacement([{ bearing: 240, distance: 4 }]).bearing
    ).toBeCloseTo(240, 10);
  });

  it("walks the corners and the points along the voyage", () => {
    const corners = voyageCorners(voyage);
    expect(corners[2]?.east).toBeCloseTo(6, 10);
    expect(corners[2]?.north).toBeCloseTo(8, 10);
    const middle = voyagePoint(voyage, 10);
    expect(middle.east).toBeCloseTo(6, 10);
    expect(middle.north).toBeCloseTo(4, 10);
    expect(voyagePoint(voyage, -1).east).toBeCloseTo(0, 10);
    expect(voyagePoint(voyage, 99).north).toBeCloseTo(8, 10);
  });
});
