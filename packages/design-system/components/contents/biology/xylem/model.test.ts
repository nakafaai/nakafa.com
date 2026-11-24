import { describe, expect, it } from "@effect/vitest";
import { evaluateXylemLift } from "@repo/design-system/components/contents/biology/xylem/model";

describe("xylem cohesion-tension lift model", () => {
  it("shows only transpiration pull reaches tall canopies", () => {
    const rootLow = evaluateXylemLift("rootPressure", 2);
    const rootTall = evaluateXylemLift("rootPressure", 25);
    const capTall = evaluateXylemLift("capillary", 25);
    const pullTall = evaluateXylemLift("transpirationPull", 25);

    expect(rootLow.reachesTop).toBe(true);
    expect(rootTall.reachesTop).toBe(false);
    expect(capTall.reachesTop).toBe(false);
    expect(pullTall.reachesTop).toBe(true);
    expect(pullTall.pressureKpa).toBeCloseTo(245.3, 1);
  });
});
