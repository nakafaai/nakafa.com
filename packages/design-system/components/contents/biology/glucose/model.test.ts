import { describe, expect, it } from "@effect/vitest";
import { evaluateGlucoseFeedback } from "@repo/design-system/components/contents/biology/glucose/model";

describe("blood glucose feedback model", () => {
  it("maps each physiological state to the expected pancreatic hormone and liver glycogen store", () => {
    expect(evaluateGlucoseFeedback("afterMeal", 160).hormone).toBe("insulin");
    expect(evaluateGlucoseFeedback("normal", 95).hormone).toBe("balanced");
    expect(evaluateGlucoseFeedback("fasting", 65).hormone).toBe("glucagon");
    expect(evaluateGlucoseFeedback("diabetes", 220).hormone).toBe("deficient");
    expect(
      evaluateGlucoseFeedback("afterMeal", 160).glycogenScale
    ).toBeGreaterThan(evaluateGlucoseFeedback("fasting", 65).glycogenScale);
  });
});
