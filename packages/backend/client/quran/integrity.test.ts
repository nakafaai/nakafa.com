import {
  hasExactQuranVerseRange,
  hasExpectedQuranNeighbors,
} from "@repo/backend/client/quran/integrity";
import { describe, expect, it } from "vitest";

/** Builds the minimal validator-independent verse identity used by integrity checks. */
function verses(...numbers: number[]) {
  return numbers.map((inSurah) => ({ number: { inSurah } }));
}

/** Builds the minimal surah identity used by neighboring-page checks. */
function surah(number: number) {
  return { number };
}

describe("hasExactQuranVerseRange", () => {
  it("accepts one exact positive integer range", () => {
    expect(hasExactQuranVerseRange(verses(2, 3, 4), 2, 4)).toBe(true);
  });

  it("rejects invalid or noninteger bounds", () => {
    expect(hasExactQuranVerseRange(verses(0), 0, 0)).toBe(false);
    expect(hasExactQuranVerseRange(verses(1), 1.5, 1.5)).toBe(false);
    expect(hasExactQuranVerseRange(verses(1), 1, Number.NaN)).toBe(false);
    expect(
      hasExactQuranVerseRange(verses(1), 1, Number.POSITIVE_INFINITY)
    ).toBe(false);
    expect(hasExactQuranVerseRange([], 2, 1)).toBe(false);
  });

  it("rejects the wrong range length, order, or sequence", () => {
    expect(hasExactQuranVerseRange(verses(1), 1, 2)).toBe(false);
    expect(hasExactQuranVerseRange(verses(2, 1), 1, 2)).toBe(false);
    expect(hasExactQuranVerseRange(verses(1, 3), 1, 2)).toBe(false);
  });
});

describe("hasExpectedQuranNeighbors", () => {
  it("accepts exact first, middle, last, and only-surah identities", () => {
    expect(hasExpectedQuranNeighbors(null, surah(2), 1, 3)).toBe(true);
    expect(hasExpectedQuranNeighbors(surah(1), surah(3), 2, 3)).toBe(true);
    expect(hasExpectedQuranNeighbors(surah(2), null, 3, 3)).toBe(true);
    expect(hasExpectedQuranNeighbors(null, null, 1, 1)).toBe(true);
  });

  it("rejects wrong neighbor identities and invalid page bounds", () => {
    expect(hasExpectedQuranNeighbors(surah(1), surah(2), 2, 3)).toBe(false);
    expect(hasExpectedQuranNeighbors(null, null, 2, 3)).toBe(false);
    expect(hasExpectedQuranNeighbors(null, surah(2), 1.5, 3)).toBe(false);
    expect(hasExpectedQuranNeighbors(null, surah(2), 1, 3.5)).toBe(false);
    expect(hasExpectedQuranNeighbors(null, null, 1, 0)).toBe(false);
  });
});
