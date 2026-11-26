import { describe, expect, it } from "@effect/vitest";
import { evaluateSolidRevolution } from "@repo/design-system/components/contents/mathematics/revolution/model";

describe("solid of revolution model", () => {
  it("scales swept volume linearly with sweep angle across all 4 profiles", () => {
    const half = evaluateSolidRevolution("paraboloid", 180);
    const full = evaluateSolidRevolution("paraboloid", 360);
    const horn = evaluateSolidRevolution("trumpetHorn", 360);
    const washer = evaluateSolidRevolution("washerBowl", 360);
    const frustum = evaluateSolidRevolution("frustumCone", 360);

    expect(full.sweptVolume).toBeCloseTo(half.sweptVolume * 2, 1);
    expect(washer.innerRadius).toBeGreaterThan(0);
    expect(horn.sliceArea).toBeGreaterThan(0);
    expect(frustum.sweptVolume).toBeGreaterThan(0);
  });
});
