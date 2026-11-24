import { describe, expect, it } from "@effect/vitest";
import { evaluatePhloemFlow } from "@repo/design-system/components/contents/biology/phloem/model";

describe("phloem translocation model", () => {
  it("increases turgor pressure with sucrose loading and swells above a bark ring", () => {
    const low = evaluatePhloemFlow("intact", 20);
    const high = evaluatePhloemFlow("intact", 80);
    const ringed = evaluatePhloemFlow("ringed", 80);

    expect(high.pressureMpa).toBeGreaterThan(low.pressureMpa);
    expect(high.flowRate).toBeGreaterThan(low.flowRate);
    expect(ringed.bulgeScale).toBeGreaterThan(high.bulgeScale);
    expect(ringed.flowRate).toBeLessThan(high.flowRate);
  });
});
