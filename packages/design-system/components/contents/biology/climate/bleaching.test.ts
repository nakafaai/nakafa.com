// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  alertOf,
  heatingWeeksOf,
  hotspotOf,
  palenessOf,
  REEF_MMM,
} from "@repo/design-system/components/contents/biology/climate/bleaching";

describe("coral heat stress", () => {
  it("counts only HotSpots of a degree or more, over 12 weeks at most", () => {
    expect(hotspotOf(28, REEF_MMM)).toBe(0);
    expect(heatingWeeksOf(29.5, 12, REEF_MMM)).toBe(0);
    expect(heatingWeeksOf(30, 4, REEF_MMM)).toBe(4);
    expect(heatingWeeksOf(31, 20, REEF_MMM)).toBe(24);
    expect(heatingWeeksOf(31, -2, REEF_MMM)).toBe(0);
  });

  it("names Coral Reef Watch's alert levels", () => {
    expect(alertOf(0, 0)).toBe("calm");
    expect(alertOf(0.5, 0)).toBe("watch");
    expect(alertOf(1, 2)).toBe("warning");
    expect(alertOf(1, 4)).toBe("bleaching");
    expect(alertOf(2, 8)).toBe("dying");
  });

  it("pales the coral fully by 8 degree-weeks", () => {
    expect(palenessOf(0)).toBe(0);
    expect(palenessOf(4.5)).toBeCloseTo(0.5);
    expect(palenessOf(12)).toBe(1);
  });
});
