import { describe, expect, it } from "@effect/vitest";

import { atomSymbol } from "@repo/design-system/components/contents/chemistry/symbol";

describe("atomSymbol", () => {
  it("writes the symbol of each element that a particle scene draws", () => {
    expect(atomSymbol("carbon")).toBe("C");
    expect(atomSymbol("hydrogen")).toBe("H");
    expect(atomSymbol("nitrogen")).toBe("N");
    expect(atomSymbol("oxygen")).toBe("O");
  });
});
