import { describe, expect, it } from "@effect/vitest";

import { getColor } from "@repo/design-system/lib/color";

describe("getColor", () => {
  it("reads a named color from the palette", () => {
    expect(getColor("ZINC")).toBe("#71717a");
  });

  it("reads a shade of each color family", () => {
    expect(getColor("AMBER", 500)).toBe("#f59e0b");
    expect(getColor("BLUE", 300)).toBe("#93c5fd");
    expect(getColor("EMERALD", 100)).toBe("#d1fae5");
    expect(getColor("GRAY", 700)).toBe("#374151");
    expect(getColor("NEUTRAL", 800)).toBe("#262626");
    expect(getColor("ORANGE", 500)).toBe("#f97316");
    expect(getColor("RED", 500)).toBe("#ef4444");
    expect(getColor("SKY", 400)).toBe("#38bdf8");
    expect(getColor("SLATE", 900)).toBe("#0f172a");
    expect(getColor("STONE", 600)).toBe("#57534e");
    expect(getColor("TEAL", 700)).toBe("#0f766e");
    expect(getColor("VIOLET", 500)).toBe("#8b5cf6");
    expect(getColor("ZINC", 950)).toBe("#09090b");
  });
});
