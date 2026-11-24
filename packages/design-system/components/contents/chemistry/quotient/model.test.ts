// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { evaluateQuotient } from "@repo/design-system/components/contents/chemistry/quotient/model";

describe("equilibrium quotient lab model", () => {
  it("evaluates Qc across stoichiometries and classifies shift direction against Kc", () => {
    const forward = evaluateQuotient(1, 1, 4, "oneToTwo");
    expect(forward.qc).toBe(1);
    expect(forward.direction).toBe("forward");
    expect(forward.tiltRad).toBeLessThan(0);

    const balanced = evaluateQuotient(1, 2, 4, "oneToTwo");
    expect(balanced.qc).toBe(4);
    expect(balanced.direction).toBe("equilibrium");
    expect(balanced.tiltRad).toBeCloseTo(0, 4);

    const reverse = evaluateQuotient(0.5, 3, 4, "oneToTwo");
    expect(reverse.qc).toBe(18);
    expect(reverse.direction).toBe("reverse");
    expect(reverse.tiltRad).toBeGreaterThan(0);

    expect(evaluateQuotient(2, 4, 2, "oneToOne").direction).toBe("equilibrium");
    expect(evaluateQuotient(2, 4, 2, "twoToTwo").qc).toBe(4);
  });
});
