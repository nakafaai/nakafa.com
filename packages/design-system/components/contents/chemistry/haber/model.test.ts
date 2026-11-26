import { describe, expect, it } from "@effect/vitest";
import { evaluateHaberConverter } from "@repo/design-system/components/contents/chemistry/haber/model";

describe("haber ammonia converter model", () => {
  it("increases equilibrium yield with pressure and lowers yield while raising rate with temperature", () => {
    const lowP = evaluateHaberConverter(450, 50);
    const highP = evaluateHaberConverter(450, 250);
    const hot = evaluateHaberConverter(580, 250);

    expect(highP.yieldPercent).toBeGreaterThan(lowP.yieldPercent);
    expect(hot.yieldPercent).toBeLessThan(highP.yieldPercent);
    expect(hot.relativeRate).toBeGreaterThan(highP.relativeRate);
  });
});
