import { describe, expect, it } from "@effect/vitest";
import { wordsOf } from "@repo/backend/confect/nina/memory/words";

describe("memory words", () => {
  it("splits a text into lower case words and numbers, in the order they appear", () => {
    expect(wordsOf("Aku kelas 12 IPA, ikut SNBT-2027!")).toEqual([
      "kelas",
      "12",
      "ipa",
      "ikut",
      "snbt",
      "2027",
    ]);
  });

  it("says each word once, whatever its case", () => {
    expect(wordsOf("Limit limit LIMIT rumus Limit")).toEqual([
      "limit",
      "rumus",
    ]);
  });

  it("drops a run of fewer than three characters and a single digit, but keeps a number of two digits", () => {
    expect(wordsOf("di ke a 5 12 ab 7 99 100")).toEqual(["12", "99", "100"]);
  });

  it.each([
    ["Indonesian", "yang dan atau dengan untuk"],
    ["English", "the and with that about"],
    ["German", "der die das und nicht"],
  ])("drops a %s stop word and keeps the word beside it", (_, stops) => {
    expect(wordsOf(`${stops} trigonometri`)).toEqual(["trigon"]);
  });

  it("compares a stop word whole, before the cut", () => {
    expect(wordsOf("about aboutness")).toEqual(["aboutn"]);
  });

  it("cuts a long word to six characters, so that cognates become one word", () => {
    expect(wordsOf("trigonometri trigonometry Trigonometrie")).toEqual([
      "trigon",
    ]);
    expect(wordsOf("matematika mathematics")).toEqual(["matema", "mathem"]);
    // A word of exactly six characters stays whole.
    expect(wordsOf("limits")).toEqual(["limits"]);
  });

  it("reads one form of a character: full width letters and ligatures become plain ones", () => {
    expect(wordsOf("ＳＮＢＴ ﬁnal ½")).toEqual(["snbt", "final"]);
  });

  it("counts and cuts by character, never between the two halves of one", () => {
    // Each of these characters takes two code units.
    expect(wordsOf("\u{20000}\u{20001}")).toEqual([]);
    expect(wordsOf("\u{20000}\u{20001}\u{20002}")).toEqual([
      "\u{20000}\u{20001}\u{20002}",
    ]);
    expect(
      wordsOf("\u{20000}\u{20001}\u{20002}\u{20003}\u{20004}\u{20005}\u{20006}")
    ).toEqual(["\u{20000}\u{20001}\u{20002}\u{20003}\u{20004}\u{20005}"]);
  });

  it("finds nothing in a text without a word", () => {
    expect(wordsOf("")).toEqual([]);
    expect(wordsOf("  ... ?! -- 😀😀😀")).toEqual([]);
    expect(wordsOf("Aku dan kamu")).toEqual([]);
  });
});
