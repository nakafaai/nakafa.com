import { describe, expect, it } from "@effect/vitest";
import { evaluateRubberStretch } from "@repo/design-system/components/contents/chemistry/rubber/model";

describe("rubber vulcanisation model", () => {
  it("prevents permanent chain slip and preserves high elastic recovery when vulcanised", () => {
    const natural = evaluateRubberStretch("naturalLatex", 80);
    const vulcanised = evaluateRubberStretch("vulcanisedRubber", 80);

    expect(natural.crosslinked).toBe(false);
    expect(vulcanised.crosslinked).toBe(true);
    expect(vulcanised.chainSlip).toBeLessThan(natural.chainSlip);
    expect(vulcanised.elasticRecoveryPercent).toBeGreaterThan(
      natural.elasticRecoveryPercent
    );
  });
});
