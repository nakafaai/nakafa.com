import { describe, expect, it } from "@effect/vitest";
import { photoRatio } from "@/components/tenant/classes/forum/photo";

describe("photoRatio", () => {
  it("keeps a photo's own shape between one by two and three by one, and stands an unknown one square", () => {
    expect(photoRatio(1600, 1200)).toBe(1600 / 1200);
    expect(photoRatio(100, 2000)).toBe(0.5);
    expect(photoRatio(4000, 500)).toBe(3);
    expect(photoRatio(null, 600)).toBe(1);
    expect(photoRatio(800, null)).toBe(1);
    expect(photoRatio(0, 600)).toBe(1);
    expect(photoRatio(800, 0)).toBe(1);
  });
});
