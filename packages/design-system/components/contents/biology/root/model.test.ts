import { describe, expect, it } from "@effect/vitest";
import { evaluateRootUptake } from "@repo/design-system/components/contents/biology/root/model";

describe("root hair uptake model", () => {
  it("draws water into root hairs in dilute soil and reverses in saline soil", () => {
    const dilute = evaluateRootUptake(15);
    const iso = evaluateRootUptake(50);
    const saline = evaluateRootUptake(85);

    expect(dilute.direction).toBe("intoRoot");
    expect(dilute.atpActive).toBe(true);
    expect(iso.direction).toBe("balanced");
    expect(saline.direction).toBe("outOfRoot");
    expect(saline.fluxSpeed).toBeGreaterThan(iso.fluxSpeed);
  });
});
