// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  filamentPath,
  GLOBE,
  GLOBE_CENTRE,
  GLOBE_HEIGHT,
  globeOutline,
  LEADS,
} from "@repo/design-system/components/contents/mathematics/binary/globe";
import { Array as Arr } from "effect";

describe("a G45 globe bulb", () => {
  it("is 45 mm across and stands on its cap", () => {
    expect(GLOBE.radius * 2).toBeCloseTo(0.045, 9);
    expect(GLOBE_HEIGHT - GLOBE_CENTRE).toBeCloseTo(GLOBE.radius, 9);
  });

  it("draws its outline from the cap to the pole without a step", () => {
    const outline = globeOutline();
    const [firstRadius, firstHeight] = Arr.getUnsafe(outline, 0);
    const [lastRadius, lastHeight] = Arr.lastNonEmpty(outline);
    expect(firstRadius).toBe(GLOBE.neck.radius);
    expect(firstHeight).toBe(GLOBE.cap.height);
    expect(lastRadius).toBeCloseTo(0, 9);
    expect(lastHeight).toBeCloseTo(GLOBE_HEIGHT, 9);
    const heights = Arr.map(outline, ([, height]) => height);
    expect(
      Arr.every(Arr.zip(heights, Arr.drop(heights, 1)), ([a, b]) => b > a)
    ).toBe(true);
  });

  it("joins the sphere to the neck at the neck's waist", () => {
    const [radius] = Arr.getUnsafe(globeOutline(), 2);
    expect(radius).toBeCloseTo(GLOBE.neck.waist, 9);
  });

  it("hangs the filament between the lead-in tips, inside the glass", () => {
    const path = filamentPath();
    const [startX, startY] = Arr.getUnsafe(path, 0);
    const [endX, endY] = Arr.lastNonEmpty(path);
    expect(startX).toBeCloseTo(-LEADS.tip.spread, 9);
    expect(endX).toBeCloseTo(LEADS.tip.spread, 9);
    expect(startY).toBeCloseTo(LEADS.tip.height, 9);
    expect(endY).toBeCloseTo(LEADS.tip.height, 9);
    expect(
      Arr.every(
        path,
        ([x, y]) => Math.hypot(x, y - GLOBE_CENTRE) < GLOBE.radius - 0.004
      )
    ).toBe(true);
  });
});
