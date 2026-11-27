import { describe, expect, it } from "@effect/vitest";
import { slottedStack } from "@repo/design-system/components/three/apparatus/mass";
import { Array as Arr } from "effect";

describe("slottedStack", () => {
  it("makes a load up from the heaviest masses that still fit", () => {
    expect(
      Arr.map(slottedStack(39).masses, (mass) => mass.weight)
    ).toStrictEqual([10, 10, 10, 5, 2, 2]);
    expect(
      Arr.map(slottedStack(7.4).masses, (mass) => mass.weight)
    ).toStrictEqual([5, 2]);
  });

  it("rests each mass on the one under it", () => {
    const stack = slottedStack(25);
    expect(Arr.map(stack.masses, (mass) => mass.base)).toStrictEqual([
      0, 0.11, 0.22,
    ]);
    expect(stack.height).toBeCloseTo(0.28, 12);
  });

  it("leaves the hanger empty for no load and for a push", () => {
    expect(slottedStack(0)).toStrictEqual({ height: 0, masses: [] });
    expect(slottedStack(-4)).toStrictEqual({ height: 0, masses: [] });
  });
});
