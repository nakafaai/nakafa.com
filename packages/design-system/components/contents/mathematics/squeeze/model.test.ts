import { describe, expect, it } from "@effect/vitest";
import { evaluateSqueezeTheorem } from "@repo/design-system/components/contents/mathematics/squeeze/model";

describe("squeeze theorem wave model", () => {
  it("pinches bound spread toward zero as radius shrinks across all envelopes", () => {
    const quadWide = evaluateSqueezeTheorem("quadraticSine", 0.8);
    const quadTight = evaluateSqueezeTheorem("quadraticSine", 0.1);
    const lin = evaluateSqueezeTheorem("linearDamped", 0.5);
    const sinc = evaluateSqueezeTheorem("sincEnvelope", 0.3);

    expect(quadTight.boundSpread).toBeLessThan(quadWide.boundSpread);
    expect(lin.limitValue).toBe(0);
    expect(sinc.limitValue).toBe(1);
    expect(sinc.boundSpread).toBeGreaterThan(0);
  });
});
