import { describe, expect, it } from "@effect/vitest";
import { evaluatePhytoremediation } from "@repo/design-system/components/contents/biology/remediation/model";

describe("phytoremediation model", () => {
  it("reduces remaining heavy-metal fraction with each harvest cycle", () => {
    const start = evaluatePhytoremediation("mustard", 0);
    const afterThree = evaluatePhytoremediation("mustard", 3);
    const hyacinth = evaluatePhytoremediation("hyacinth", 3);
    const vetiver = evaluatePhytoremediation("vetiver", 2);

    expect(start.remainingPercent).toBe(100);
    expect(afterThree.remainingPercent).toBeLessThan(start.remainingPercent);
    expect(hyacinth.isAquatic).toBe(true);
    expect(hyacinth.remainingPercent).toBeLessThan(afterThree.remainingPercent);
    expect(vetiver.isAquatic).toBe(false);
  });
});
