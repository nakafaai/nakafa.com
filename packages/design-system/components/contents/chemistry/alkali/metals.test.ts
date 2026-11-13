import { describe, expect, it } from "@effect/vitest";
import {
  floats,
  getMetal,
  MetalIdSchema,
  pieceAt,
  reacted,
} from "@repo/design-system/components/contents/chemistry/alkali/metals";
import { Array as Arr } from "effect";

describe("metals in water", () => {
  it("floats lithium, sodium and potassium and sinks magnesium and calcium", () => {
    expect(Arr.filter(MetalIdSchema.literals, floats)).toEqual([
      "lithium",
      "sodium",
      "potassium",
    ]);
  });

  it("orders group 1 by falling ionization energy and rising activity", () => {
    const group = Arr.map(
      ["lithium", "sodium", "potassium"] as const,
      getMetal
    );
    expect(Arr.map(group, (metal) => metal.ionization)).toEqual([
      520.2, 495.8, 418.8,
    ]);
    expect(Arr.map(group, (metal) => metal.radius)).toEqual([152, 186, 227]);
    expect(getMetal("magnesium").activity).toBeLessThan(
      getMetal("sodium").activity
    );
  });

  it("uses a brisk metal up within the run and barely starts a slow one", () => {
    expect(reacted("potassium", 10, 10)).toBeGreaterThan(0.98);
    expect(reacted("magnesium", 10, 10)).toBeLessThan(0.2);
    expect(reacted("sodium", -1, 10)).toBe(0);
  });

  it("floats a light piece on the surface and rests a heavy one on the bottom", () => {
    const sodium = pieceAt("sodium", 0, 10, 4);
    const magnesium = pieceAt("magnesium", 2, 10, 4);

    expect(sodium.y).toBeCloseTo(4 + 0.45 * 0.3, 9);
    expect(sodium.x).toBeCloseTo(0.7 * 3.2, 9);
    expect(magnesium.x).toBe(0);
    expect(magnesium.y).toBe(magnesium.size);
    expect(pieceAt("potassium", 10, 10, 4).size).toBeLessThan(0.2);
  });
});
