import { describe, expect, it } from "@effect/vitest";
import {
  paintDashes,
  paintVerge,
} from "@repo/design-system/components/three/stage/marks";
import { Array as Arr } from "effect";

describe("paintDashes", () => {
  it("is white along the dash and black after it", () => {
    const row = paintDashes(8, 0.5);
    expect(Arr.makeBy(8, (pixel) => row[pixel * 4 + 1])).toEqual([
      255, 255, 255, 255, 0, 0, 0, 0,
    ]);
  });
});

describe("paintVerge", () => {
  it("is black at both ends and white across the middle", () => {
    const row = paintVerge(9, 0.25);
    const alpha = Arr.makeBy(9, (pixel) => row[pixel * 4 + 1] ?? 0);
    expect(alpha[0]).toBe(0);
    expect(alpha[8]).toBe(0);
    expect(alpha[4]).toBe(255);
    expect(alpha[1]).toBeGreaterThan(0);
    expect(alpha[1]).toBeLessThan(255);
  });
});
