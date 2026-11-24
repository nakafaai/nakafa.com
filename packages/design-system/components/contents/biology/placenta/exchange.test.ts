import { describe, expect, it } from "@effect/vitest";
import {
  particleX,
  SUBSTANCES,
  transferMode,
} from "@repo/design-system/components/contents/biology/placenta/exchange";

describe("transferMode", () => {
  it("classifies every placental substance into mother-to-foetus, foetus-to-mother, or blocked", () => {
    expect(SUBSTANCES).toHaveLength(8);
    expect(transferMode("oxygen")).toBe("toFoetus");
    expect(transferMode("glucose")).toBe("toFoetus");
    expect(transferMode("aminoAcids")).toBe("toFoetus");
    expect(transferMode("antibodies")).toBe("toFoetus");
    expect(transferMode("alcohol")).toBe("toFoetus");
    expect(transferMode("carbonDioxide")).toBe("toMother");
    expect(transferMode("urea")).toBe("toMother");
    expect(transferMode("bloodCells")).toBe("blocked");
  });
});

describe("particleX", () => {
  it("crosses left-to-right for toFoetus, right-to-left for toMother, and bounces off the barrier for blocked", () => {
    expect(particleX("toFoetus", 0)).toBeCloseTo(-0.38, 5);
    expect(particleX("toFoetus", 0.99)).toBeGreaterThan(0.3);
    expect(particleX("toMother", 0)).toBeCloseTo(0.38, 5);
    expect(particleX("toMother", 0.99)).toBeLessThan(-0.3);
    expect(particleX("blocked", 0.5)).toBeLessThan(0);
    expect(particleX("blocked", 0)).toBeCloseTo(-0.38, 5);
  });
});
