import { describe, expect, it } from "@effect/vitest";
import { evaluateFruitOrigin } from "@repo/design-system/components/contents/biology/fruit/model";

describe("fruit and seed origin model", () => {
  it("distinguishes simple, aggregate, and multiple fruit origins", () => {
    const simple = evaluateFruitOrigin("simple");
    const aggregate = evaluateFruitOrigin("aggregate");
    const multiple = evaluateFruitOrigin("multiple");

    expect(simple.flowerCount).toBe(1);
    expect(simple.carpelCount).toBe(1);
    expect(aggregate.flowerCount).toBe(1);
    expect(aggregate.carpelCount).toBeGreaterThan(1);
    expect(multiple.flowerCount).toBeGreaterThan(1);
  });
});
