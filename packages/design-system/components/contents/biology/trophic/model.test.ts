import { describe, expect, it } from "@effect/vitest";
import { evaluateTrophicPyramid } from "@repo/design-system/components/contents/biology/trophic/model";

describe("food web trophic pyramid model", () => {
  it("models 10% trophic transfer and disturbance shifts across all scenarios", () => {
    const balanced = evaluateTrophicPyramid("balanced", 10_000);
    const noPredator = evaluateTrophicPyramid("removePredator", 10_000);
    const bloom = evaluateTrophicPyramid("algalBloom", 10_000);
    const harvest = evaluateTrophicPyramid("overharvest", 10_000);

    expect(balanced.producerKj).toBe(10_000);
    expect(balanced.primaryKj).toBe(1000);
    expect(balanced.secondaryKj).toBe(100);
    expect(balanced.tertiaryKj).toBe(10);
    expect(noPredator.tertiaryKj).toBe(0);
    expect(noPredator.primaryKj).toBeGreaterThan(balanced.primaryKj);
    expect(bloom.producerKj).toBeGreaterThan(balanced.producerKj);
    expect(harvest.producerKj).toBeLessThan(balanced.producerKj);
  });
});
