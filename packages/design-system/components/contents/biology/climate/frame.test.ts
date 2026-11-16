// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  frameOf,
  insideAt,
  markOf,
  outline,
  outsideAt,
  surfaceOf,
  waterOf,
} from "@repo/design-system/components/contents/biology/climate/frame";
import { Array as Arr } from "effect";

const frame = frameOf({ height: 405, width: 720 });

describe("the water level", () => {
  it("stands on the floor at 250 ppm and at the lip at 600 ppm, never beyond", () => {
    expect(surfaceOf(frame, 250)).toBe(frame.bottom);
    expect(surfaceOf(frame, 600)).toBeCloseTo(frame.top);
    expect(surfaceOf(frame, 100)).toBe(frame.bottom);
    expect(surfaceOf(frame, 900)).toBeCloseTo(frame.top);
    expect(surfaceOf(frame, 425)).toBeCloseTo((frame.bottom + frame.top) / 2);
  });

  it("marks the air before industry low in the tub, above the floor", () => {
    expect(markOf(frame)).toBeLessThan(frame.bottom);
    expect(markOf(frame)).toBeGreaterThan(surfaceOf(frame, 300));
  });
});

describe("the tub's walls", () => {
  const heights = Arr.map(
    Arr.range(0, 40),
    (step) => frame.top + ((frame.bottom - frame.top) * step) / 40
  );

  it("keep the glaze inside the shell at every height, so no wall crosses another", () => {
    Arr.forEach(heights, (y) => {
      expect(insideAt(frame, y, "left")).toBeGreaterThan(
        outsideAt(frame, y, "left")
      );
      expect(insideAt(frame, y, "right")).toBeLessThan(
        outsideAt(frame, y, "right")
      );
      expect(insideAt(frame, y, "left")).toBeLessThan(
        insideAt(frame, y, "right")
      );
    });
  });

  it("curve in toward the floor and stay straight above the lip", () => {
    expect(insideAt(frame, frame.bottom, "left")).toBeGreaterThan(
      insideAt(frame, frame.top, "left")
    );
    expect(insideAt(frame, frame.top - 10, "left")).toBe(
      insideAt(frame, frame.top, "left")
    );
    expect(outsideAt(frame, frame.base + 10, "right")).toBe(
      outsideAt(frame, frame.base, "right")
    );
  });

  it("keep the tub and its waste clear of the chart, which starts at 46% of the width", () => {
    expect(frame.right + frame.width * 0.007).toBeLessThan(frame.width * 0.46);
    expect(frame.column).toBeGreaterThan(0);
    expect(frame.outlet[0]).toBeGreaterThan(frame.left);
    expect(frame.outlet[1]).toBeLessThan(frame.ground);
  });
});

describe("an outline", () => {
  it("runs down the left edge and back up the right", () => {
    const points = outline(0, 10, (y, side) => (side === "left" ? -y : y));
    expect(points.length).toBe(58);
    expect(points[0]).toEqual([-0, 0]);
    expect(points[28]).toEqual([-10, 10]);
    expect(points[29]).toEqual([10, 10]);
    expect(points[57]).toEqual([0, 0]);
  });

  it("gives the water from its surface down to the floor", () => {
    const surface = surfaceOf(frame, 420);
    const water = waterOf(frame, surface);
    expect(water[0]).toEqual([insideAt(frame, surface, "left"), surface]);
    expect(water[28]?.[1]).toBe(frame.bottom);
  });
});
