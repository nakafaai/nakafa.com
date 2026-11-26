import { describe, expect, it } from "@effect/vitest";
import { evaluateAlveolusExchange } from "@repo/design-system/components/contents/biology/alveolus/model";

describe("alveolus gas exchange model", () => {
  it("increases O2 uptake during exercise and drops gradient at high altitude", () => {
    const rest = evaluateAlveolusExchange("rest", 12);
    const exercise = evaluateAlveolusExchange("exercise", 24);
    const altitude = evaluateAlveolusExchange("highAltitude", 18);

    expect(rest.oxygenUptakeMlPerMin).toBe(250);
    expect(exercise.oxygenUptakeMlPerMin).toBeGreaterThan(
      rest.oxygenUptakeMlPerMin
    );
    expect(altitude.pO2GradientMmHg).toBeLessThan(rest.pO2GradientMmHg);
  });
});
