import {
  isSyntacticHalfIntegerPiMultiple,
  isSyntacticIntegerPiMultiple,
  readAbsolutePiMultiple,
  readCombinedPiMultiple,
  readNegatedPiMultiple,
  readProductPiMultiple,
  readQuotientPiMultiple,
  readSyntacticPiMultiple,
} from "@repo/math/schema/ast/pi";
import { describe, expect, it } from "vitest";

describe("syntactic pi multiple tracking", () => {
  it("reads exact pi multiples without numeric tolerance", () => {
    expect(readSyntacticPiMultiple("0", 0)).toBe(0);
    expect(readSyntacticPiMultiple("pi", Math.PI)).toBe(1);
    expect(readSyntacticPiMultiple("3*pi/2", (3 * Math.PI) / 2)).toBe(1.5);
    expect(readSyntacticPiMultiple("pi*pi", Math.PI * Math.PI)).toBeUndefined();
    expect(readSyntacticPiMultiple("pi+1", Math.PI + 1)).toBeUndefined();
    expect(
      readSyntacticPiMultiple("3.141592653589793", Math.PI)
    ).toBeUndefined();
    expect(readSyntacticPiMultiple("left", 0)).toBeUndefined();
  });

  it("classifies only tracked integer and half-integer multiples", () => {
    expect(isSyntacticIntegerPiMultiple(2)).toBe(true);
    expect(isSyntacticIntegerPiMultiple(0.5)).toBe(false);
    expect(isSyntacticIntegerPiMultiple(undefined)).toBe(false);
    expect(isSyntacticHalfIntegerPiMultiple(1.5)).toBe(true);
    expect(isSyntacticHalfIntegerPiMultiple(1)).toBe(false);
    expect(isSyntacticHalfIntegerPiMultiple(undefined)).toBe(false);
  });

  it("carries pi multiples through exact constant operations", () => {
    expect(readNegatedPiMultiple(2)).toBe(-2);
    expect(readNegatedPiMultiple(undefined)).toBeUndefined();
    expect(readAbsolutePiMultiple(-2)).toBe(2);
    expect(readAbsolutePiMultiple(undefined)).toBeUndefined();
    expect(readCombinedPiMultiple(1, 2, "add")).toBe(3);
    expect(readCombinedPiMultiple(1, 2, "subtract")).toBe(-1);
    expect(readCombinedPiMultiple(undefined, 2, "add")).toBeUndefined();
    expect(
      readProductPiMultiple({ piMultiple: 2, value: 2 * Math.PI }, { value: 3 })
    ).toBe(6);
    expect(
      readProductPiMultiple({ value: 3 }, { piMultiple: 2, value: 2 * Math.PI })
    ).toBe(6);
    expect(
      readProductPiMultiple(
        { piMultiple: 0.5, value: Math.PI / 2 },
        { value: 2 }
      )
    ).toBe(1);
    expect(
      readProductPiMultiple(
        { piMultiple: 1e-308, value: Math.PI * 1e-308 },
        { value: 1e308 }
      )
    ).toBe(1);
    expect(
      readProductPiMultiple({ piMultiple: 1, value: Math.PI }, { value: -2 })
    ).toBe(-2);
    expect(
      readProductPiMultiple(
        { piMultiple: 1, value: Math.PI },
        { value: Number.POSITIVE_INFINITY }
      )
    ).toBe(Number.POSITIVE_INFINITY);
    expect(
      readProductPiMultiple(
        { piMultiple: 1e308, value: 1e308 },
        { value: 1e308 }
      )
    ).toBe(Number.POSITIVE_INFINITY);
    expect(
      readProductPiMultiple(
        { piMultiple: 1e-308, value: 1e-308 },
        { value: 1e-308 }
      )
    ).toBe(0);
    expect(
      readProductPiMultiple(
        { piMultiple: 1, value: Math.PI },
        { piMultiple: 2, value: 2 * Math.PI }
      )
    ).toBeUndefined();
    expect(
      readQuotientPiMultiple(
        { piMultiple: 2, value: 2 * Math.PI },
        { value: 4 }
      )
    ).toBe(0.5);
    expect(
      readQuotientPiMultiple({ value: 2 }, { piMultiple: 1, value: Math.PI })
    ).toBeUndefined();
  });
});
