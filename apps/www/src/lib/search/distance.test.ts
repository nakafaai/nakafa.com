import { describe, expect, it } from "@effect/vitest";
import { editDistance, prefixDistance } from "@/lib/search/distance";

describe("editDistance", () => {
  it("counts each edit once, a swap of two neighbours included", () => {
    expect(editDistance("kimia", "kimia", 2)).toBe(0);
    expect(editDistance("kimai", "kimia", 2)).toBe(1);
    expect(editDistance("kima", "kimia", 2)).toBe(1);
    expect(editDistance("kimiaa", "kimia", 2)).toBe(1);
    expect(editDistance("kumia", "kimia", 2)).toBe(1);
    expect(editDistance("baqoroh", "baqarah", 2)).toBe(2);
    expect(editDistance("", "ab", 2)).toBe(2);
  });

  it("stops at one past the budget", () => {
    expect(editDistance("fisika", "kimia", 1)).toBe(2);
    expect(editDistance("a", "abcd", 2)).toBe(3);
    expect(editDistance("ab", "ba", 0)).toBe(1);
  });
});

describe("prefixDistance", () => {
  it("compares a word still being typed with the start of a longer word", () => {
    expect(prefixDistance("matematk", "matematika", 2)).toBe(1);
    expect(prefixDistance("matem", "matematika", 1)).toBe(0);
    expect(prefixDistance("zzzz", "matematika", 1)).toBe(2);
  });
});
