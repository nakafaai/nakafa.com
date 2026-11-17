// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  concentrationFactor,
  excreted,
  filteredLoad,
  perDay,
  reabsorbed,
  threshold,
  urineFlow,
} from "@repo/design-system/components/contents/biology/nephron/filtration";

describe("glucose in the nephron", () => {
  it("takes back every milligram up to the tubules' maximum", () => {
    expect(filteredLoad(125, 2)).toBe(250);
    expect(reabsorbed(250, 375)).toBe(250);
    expect(excreted(250, 375)).toBe(0);
  });

  it("spills the rest into the urine above the threshold", () => {
    expect(threshold(375, 125)).toBe(3);
    expect(filteredLoad(125, 4.2)).toBeCloseTo(525, 12);
    expect(excreted(525, 375)).toBe(150);
  });
});

describe("urea in the nephron", () => {
  const urea = { plasma: 0.03, urine: 1.8 };

  it("concentrates the urine sixtyfold and makes three litres a day from 180", () => {
    expect(concentrationFactor(urea)).toBeCloseTo(60, 12);
    expect(perDay(125)).toBe(180);
    expect(perDay(urineFlow(125, urea))).toBeCloseTo(3, 12);
  });
});
