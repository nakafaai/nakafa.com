// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  positionOf,
  segmentBounds,
  segmentEdge,
} from "@repo/design-system/components/contents/mathematics/segment";

describe("number-line segment bounds", () => {
  it("draws a missing bound as a ray to the edge of the axis", () => {
    expect(segmentBounds({ end: 3 })).toEqual({
      end: 3,
      start: Number.NEGATIVE_INFINITY,
    });
    expect(segmentBounds({ start: -1 })).toEqual({
      end: Number.POSITIVE_INFINITY,
      start: -1,
    });
    expect(segmentBounds({})).toEqual({
      end: Number.POSITIVE_INFINITY,
      start: Number.NEGATIVE_INFINITY,
    });
  });

  it("keeps the bounds that are given", () => {
    expect(segmentBounds({ end: 4, start: 1 })).toEqual({ end: 4, start: 1 });
  });

  it("names the end cap by which bounds are infinite", () => {
    expect(
      segmentEdge({
        end: Number.POSITIVE_INFINITY,
        start: Number.NEGATIVE_INFINITY,
      })
    ).toBe("bothInfinity");
    expect(segmentEdge({ end: 2, start: Number.NEGATIVE_INFINITY })).toBe(
      "startInfinity"
    );
    expect(segmentEdge({ end: Number.POSITIVE_INFINITY, start: 2 })).toBe(
      "endInfinity"
    );
    expect(segmentEdge({ end: 4, start: 1 })).toBe("finite");
  });
});

describe("number-line scale positions", () => {
  const scale = { max: 8, min: -4 };

  it("places an infinite bound on the edge of the axis it runs toward", () => {
    expect(positionOf(Number.NEGATIVE_INFINITY, scale)).toBe(0);
    expect(positionOf(Number.POSITIVE_INFINITY, scale)).toBe(100);
  });

  it("places a finite value linearly along the scale", () => {
    expect(positionOf(-4, scale)).toBe(0);
    expect(positionOf(8, scale)).toBe(100);
    expect(positionOf(2, scale)).toBe(50);
    expect(positionOf(-1, scale)).toBe(25);
  });
});
