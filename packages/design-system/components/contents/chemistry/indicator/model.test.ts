import { describe, expect, it } from "@effect/vitest";
import { evaluatePhIndicator } from "@repo/design-system/components/contents/chemistry/indicator/model";

describe("pH indicator scale model", () => {
  it("maps samples across universal, litmus, phenolphthalein, and methyl orange", () => {
    expect(evaluatePhIndicator("hydrochloricAcid", "universal").colorTone).toBe(
      "red"
    );
    expect(evaluatePhIndicator("vinegar", "universal").colorTone).toBe(
      "orange"
    );
    expect(evaluatePhIndicator("pureWater", "universal").colorTone).toBe(
      "green"
    );
    expect(evaluatePhIndicator("bakingSoda", "universal").colorTone).toBe(
      "teal"
    );
    expect(evaluatePhIndicator("sodiumHydroxide", "universal").colorTone).toBe(
      "purple"
    );
    expect(evaluatePhIndicator("hydrochloricAcid", "litmus").colorTone).toBe(
      "red"
    );
    expect(evaluatePhIndicator("pureWater", "litmus").colorTone).toBe("purple");
    expect(evaluatePhIndicator("sodiumHydroxide", "litmus").colorTone).toBe(
      "blue"
    );
    expect(evaluatePhIndicator("pureWater", "phenolphthalein").colorTone).toBe(
      "clear"
    );
    expect(
      evaluatePhIndicator("sodiumHydroxide", "phenolphthalein").colorTone
    ).toBe("pink");
    expect(
      evaluatePhIndicator("hydrochloricAcid", "methylOrange").colorTone
    ).toBe("red");
    expect(evaluatePhIndicator("pureWater", "methylOrange").colorTone).toBe(
      "yellow"
    );
  });
});
