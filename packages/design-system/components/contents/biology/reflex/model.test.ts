import { describe, expect, it } from "@effect/vitest";
import { evaluateReflex } from "@repo/design-system/components/contents/biology/reflex/model";

describe("reflex arc model", () => {
  it("distinguishes polysynaptic withdrawal from monosynaptic knee-jerk reflex", () => {
    const withdrawal = evaluateReflex("withdrawal", 45);
    const kneeJerk = evaluateReflex("kneeJerk", 100);

    expect(withdrawal).toEqual({
      activeStage: 2,
      hasRelay: true,
      synapseCount: 2,
    });
    expect(kneeJerk).toEqual({
      activeStage: 4,
      hasRelay: false,
      synapseCount: 1,
    });
  });
});
