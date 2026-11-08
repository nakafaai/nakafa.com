import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import { searchSurahs } from "@/lib/content/quran/search";

const surahs = [
  { arabic: "الفاتحة", meaning: "The Opening", number: 1, title: "Al-Fatihah" },
  { arabic: "البقرة", meaning: "The Cow", number: 2, title: "Al-Baqarah" },
  { arabic: "يس", meaning: "Ya Sin", number: 36, title: "Ya-Sin" },
  {
    arabic: "الإخلاص",
    meaning: "The Sincerity",
    number: 112,
    title: "Al-Ikhlas",
  },
];

/** The numbers of the surahs a search keeps. */
const kept = (search: string) =>
  Arr.map(searchSurahs(search, surahs), ({ number }) => number);

describe("searchSurahs", () => {
  it("keeps every surah, in order, while the search is empty or only spaces", () => {
    expect(kept("")).toEqual([1, 2, 36, 112]);
    expect(kept("   ")).toEqual([1, 2, 36, 112]);
  });

  it("finds a surah by the start of its number", () => {
    expect(kept("3")).toEqual([36]);
    expect(kept("11")).toEqual([112]);
  });

  it("finds a surah by its name however the reader spells its dashes, spaces and case", () => {
    expect(kept("al baqarah")).toEqual([2]);
    expect(kept("ALBAQARAH")).toEqual([2]);
    expect(kept("yasin")).toEqual([36]);
  });

  it("finds a surah by its Arabic name, with or without vowel signs", () => {
    expect(kept("البقرة")).toEqual([2]);
    expect(kept("الإخلاص")).toEqual([112]);
    expect(kept("بَقَرَة")).toEqual([2]);
  });

  it("finds a surah by the meaning of its name", () => {
    expect(kept("cow")).toEqual([2]);
    expect(kept("the")).toEqual([1, 2, 112]);
  });

  it("keeps nothing when no surah matches", () => {
    expect(kept("zzz")).toEqual([]);
  });
});
