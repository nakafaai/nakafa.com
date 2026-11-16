import { describe, expect, it } from "@effect/vitest";
import { getColor } from "@repo/design-system/lib/color";

describe("getColor", () => {
  it("reads a base color and the fixed black and white", () => {
    expect(getColor("STONE")).toBe("#78716c");
    expect(getColor("BLACK")).toBe("#000000");
    expect(getColor("WHITE")).toBe("#ffffff");
  });

  it("reads a shade from the scale of its own color", () => {
    expect(getColor("GRAY", 300)).toBe("#d1d5db");
    expect(getColor("NEUTRAL", 300)).toBe("#d4d4d4");
    expect(getColor("SLATE", 300)).toBe("#cbd5e1");
    expect(getColor("STONE", 600)).toBe("#57534e");
    expect(getColor("ZINC", 900)).toBe("#18181b");
  });
});
