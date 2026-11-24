import { describe, expect, it } from "@effect/vitest";
import { evaluateTransport } from "@repo/design-system/components/contents/biology/pump/model";

describe("active transport pump model", () => {
  it("moves solutes down gradient passively and against gradient using ATP", () => {
    const simple = evaluateTransport("simpleDiffusion", 60);
    const facilitated = evaluateTransport("facilitated", 60);
    const pump = evaluateTransport("activePump", 60);

    expect(simple.atpPerCycle).toBe(0);
    expect(simple.direction).toBe("downGradient");
    expect(facilitated.fluxRate).toBeGreaterThan(simple.fluxRate);
    expect(pump.atpPerCycle).toBe(1);
    expect(pump.direction).toBe("againstGradient");
  });
});
