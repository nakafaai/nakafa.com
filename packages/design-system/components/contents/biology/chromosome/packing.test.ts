import { describe, expect, it } from "@effect/vitest";
import {
  formatDnaLength,
  LEVELS,
  stretchedLengthMm,
  widthNm,
} from "@repo/design-system/components/contents/biology/chromosome/packing";
import { Array as Arr } from "effect";

describe("widthNm", () => {
  it("increases strictly from nucleotide (1 nm) to metaphase chromosome (700 nm)", () => {
    const widths = Arr.map(LEVELS, widthNm);
    expect(widths).toEqual([1, 2, 11, 30, 700]);
  });
});

describe("stretchedLengthMm and formatDnaLength", () => {
  it("computes chromosome 1 length (~84.6 mm) and formats µm, mm, and m scales", () => {
    const chr1 = stretchedLengthMm(248_956_422);
    expect(chr1).toBeCloseTo(84.645, 2);
    expect(formatDnaLength(chr1)).toBe("84.6 mm");
    expect(formatDnaLength(0.25)).toBe("250.0 µm");
    expect(formatDnaLength(2040)).toBe("2.04 m");
  });
});
