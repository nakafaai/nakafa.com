// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  arcSegments,
  ballSheet,
  sleeveArc,
} from "@repo/design-system/components/three/print/wrap";

describe("the arc a wrapped sheet covers", () => {
  it("keeps the sheet's width along the curve, centred on the front", () => {
    // A sheet a quarter of the circumference wide wraps a quarter turn.
    const arc = sleeveArc((Math.PI * 0.048) / 2, 0.048);
    expect(arc.length).toBeCloseTo(Math.PI / 2);
    expect(arc.start).toBeCloseTo(-Math.PI / 4);
  });

  it("never wraps more than once round", () => {
    expect(sleeveArc(1, 0.01).length).toBeCloseTo(Math.PI * 2);
  });

  it("covers nothing on a part without a radius", () => {
    expect(sleeveArc(0.1, 0)).toEqual({ length: 0, start: -0 });
  });
});

describe("the segments of an arc", () => {
  it("takes its share of a full circle's segments", () => {
    expect(arcSegments(Math.PI, 64)).toBe(32);
    expect(arcSegments(Math.PI * 2, 40)).toBe(40);
  });

  it("bends even a narrow label", () => {
    expect(arcSegments(0.1, 64)).toBe(6);
  });
});

describe("the sheet that covers a ball", () => {
  it("runs once round the equator and from pole to pole", () => {
    const sheet = ballSheet(0.12);
    expect(sheet.width).toBeCloseTo(0.754, 3);
    expect(sheet.height).toBeCloseTo(0.377, 3);
  });
});
