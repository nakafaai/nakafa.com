import { describe, expect, it } from "@effect/vitest";
import { spreadLabels } from "@repo/design-system/components/contents/chemistry/spectrometer/placement";

describe("labels along the detector", () => {
  it("keeps labels that already stand a gap apart", () => {
    expect(spreadLabels([2, 6, 10], 3)).toEqual([2, 6, 10]);
  });

  it("spreads crowded labels a gap apart around their marks' middle", () => {
    const [left = 0, right = 0] = spreadLabels([13.2, 13.6], 3);

    expect(right - left).toBeCloseTo(3, 9);
    expect((left + right) / 2).toBeCloseTo(13.4, 9);
  });

  it("returns no places for no labels", () => {
    expect(spreadLabels([], 3)).toEqual([]);
  });
});
