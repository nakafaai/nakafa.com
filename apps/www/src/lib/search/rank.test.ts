import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Option } from "effect";
import {
  markTitle,
  matchWord,
  prepareEntry,
  scoreEntry,
  searchEntries,
} from "@/lib/search/rank";
import { INDONESIAN_ENTRIES } from "@/lib/search/test.entries";

const PREPARED = Arr.map(INDONESIAN_ENTRIES, prepareEntry);

/** The titles of the results of a query, best first. */
function titles(query: string) {
  return Arr.map(searchEntries(PREPARED, query), ({ entry }) => entry.title);
}

describe("searchEntries", () => {
  it("answers no query with nothing", () => {
    expect(searchEntries(PREPARED, "  ")).toEqual([]);
    expect(searchEntries(PREPARED, "—")).toEqual([]);
  });

  it("puts the subject before the lesson that only names it in its trail", () => {
    expect(titles("kimia")).toEqual(["Kimia", "Teori Atom Dalton"]);
  });

  it("forgives a swapped letter and a missed one while typing", () => {
    expect(Arr.head(titles("kimai"))).toEqual(Option.some("Kimia"));
    expect(Arr.head(titles("matematk"))).toEqual(Option.some("Matematika"));
    expect(Arr.head(titles("komposisi fngsi"))).toEqual(
      Option.some("Komposisi Fungsi")
    );
  });

  it("matches an exam name only as it is spelled", () => {
    expect(Arr.head(titles("tka"))).toEqual(Option.some("TKA"));
    expect(Arr.head(titles("tk"))).toEqual(Option.some("TKA"));
    expect(titles("tki")).toEqual([]);
    expect(titles("snbx")).toEqual([]);
  });

  it("finds a set through the exam and the year above it", () => {
    expect(Arr.head(titles("snbt 2027"))).toEqual(Option.some("Set 1"));
  });

  it("finds a surah by its name typed without spaces, its meaning and its number", () => {
    expect(titles("albaqarah")).toEqual(["Al-Baqarah"]);
    expect(titles("albaqoroh")).toEqual(["Al-Baqarah"]);
    expect(titles("al baqoroh")).toEqual(["Al-Baqarah"]);
    expect(titles("sapi betina")).toEqual(["Al-Baqarah"]);
    expect(Arr.head(titles("2"))).toEqual(Option.some("Al-Baqarah"));
  });

  it("finds a lesson by another curriculum that teaches it", () => {
    expect(titles("cambridge")).toEqual(["Teori Atom Dalton"]);
  });

  it("finds a word inside a longer word, and a level by its number", () => {
    expect(titles("kabi")).toEqual(["Kabinet Merah Putih"]);
    expect(Arr.head(titles("kelas 10"))).toEqual(Option.some("Kelas 10"));
    expect(Arr.head(titles("kelas10"))).toEqual(Option.some("Kelas 10"));
  });

  it("orders equal scores by kind, then by the shorter title, then by path", () => {
    expect(titles("kurikulum")).toEqual([
      "Kurikulum Merdeka",
      "Kurikulum sekolah",
      "Kelas 10",
      "Kelas 11",
      "Kimia",
      "Fisika",
      "Matematika",
      "Komposisi Fungsi",
      "Teori Atom Dalton",
    ]);
  });
});

describe("matchWord", () => {
  it("scores the word, its start, a word inside it, then a typo", () => {
    const word = { proper: false, text: "matematika" };
    expect(matchWord("matematika", word)).toBe(1);
    expect(matchWord("mate", word)).toBeCloseTo(0.83);
    expect(matchWord("tema", word)).toBe(0.5);
    expect(matchWord("matematiks", word)).toBeCloseTo(0.55);
    expect(matchWord("xyz", word)).toBe(0);
    expect(matchWord("zzzz", word)).toBe(0);
  });

  it("never corrects a proper name", () => {
    expect(matchWord("snbx", { proper: true, text: "snbt" })).toBe(0);
  });
});

describe("scoreEntry", () => {
  it("needs every typed word to match", () => {
    const kimia = Option.getOrThrow(
      Arr.findFirst(PREPARED, ({ entry }) => entry.title === "Kimia")
    );
    expect(scoreEntry(["kimia", "fisika"], kimia)).toEqual(Option.none());
    expect(Option.isSome(scoreEntry(["kimia"], kimia))).toBe(true);
  });
});

describe("markTitle", () => {
  it("marks the words a query matched and keeps the title's spelling", () => {
    expect(markTitle("Teori Atom Dalton", "atom")).toEqual([
      { hit: false, start: 0, text: "Teori" },
      { hit: false, start: 5, text: " " },
      { hit: true, start: 6, text: "Atom" },
      { hit: false, start: 10, text: " " },
      { hit: false, start: 11, text: "Dalton" },
    ]);
    expect(markTitle("Fächer", "faecher")).toEqual([
      { hit: true, start: 0, text: "Fächer" },
    ]);
    expect(markTitle("", "atom")).toEqual([]);
  });
});
