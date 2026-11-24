import { describe, expect, it } from "@effect/vitest";
import { evaluateMonohybridCross } from "@repo/design-system/components/contents/biology/monohybrid/model";

describe("monohybrid cross model", () => {
  it("produces 4:0, 3:1, and 1:1 tall-to-dwarf ratios across F1, F2, and test crosses", () => {
    expect(evaluateMonohybridCross("pureF1").tallCount).toBe(4);
    expect(evaluateMonohybridCross("heteroF2").tallCount).toBe(3);
    expect(evaluateMonohybridCross("testCross").tallCount).toBe(2);
  });
});
