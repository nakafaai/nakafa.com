// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  dropTravel,
  quotient,
  substrateOf,
} from "@repo/design-system/components/contents/biology/respirometer/gas";

describe("respirometer", () => {
  it("moves the liquid by the oxygen taken in where potassium hydroxide absorbs the carbon dioxide", () => {
    expect(dropTravel("potash", 30, 21, 20, 20)).toBe(30);
    expect(dropTravel("potash", 30, 21, 10, 20)).toBe(15);
  });

  it("moves the liquid by the oxygen less the carbon dioxide over water", () => {
    expect(dropTravel("water", 30, 21, 20, 20)).toBe(9);
    expect(dropTravel("water", 20, 26, 20, 20)).toBe(-6);
  });

  it("names the substrate from the quotient", () => {
    expect(quotient(30, 21)).toBeCloseTo(0.7, 12);
    expect(substrateOf(0.7)).toBe("fat");
    expect(substrateOf(0.9)).toBe("protein");
    expect(substrateOf(1)).toBe("carbohydrate");
    expect(substrateOf(1.3)).toBe("anaerobic");
  });
});
