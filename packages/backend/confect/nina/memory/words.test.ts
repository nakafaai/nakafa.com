import { describe, expect, it } from "@effect/vitest";
import {
  longest,
  WORD_WORTH,
  wordsOf,
  wordWorth,
} from "@repo/backend/confect/nina/memory/words";
import { Array as Arr } from "effect";

describe("memory words", () => {
  it("splits a text into lower case words and numbers, in the order they appear", () => {
    expect(wordsOf("Aku kelas 12 IPA, ikut SNBT-2027!")).toEqual([
      "aku",
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

  it("keeps every word, however short or common, because no list and no minimum length decides what a word is", () => {
    expect(wordsOf("di ke a 5 12 ab 7 99 100 yang the und")).toEqual([
      "di",
      "ke",
      "a",
      "5",
      "12",
      "ab",
      "7",
      "99",
      "100",
      "yang",
      "the",
      "und",
    ]);
  });

  // These words pin what the platform's dictionaries find today. A different
  // answer means that what a word is has changed, and the version of the index
  // must change with it (`WORD_INDEX_VERSION` in `memory/keys`).
  it.each([
    [
      "Japanese",
      "高校三年生で、来年は東京大学を目指しています。",
      ["高校", "三", "年生", "で", "来年", "は", "東京", "大学", "を", "目指"],
    ],
    ["Chinese", "我是高三学生，明年想考清华大学。", ["我是", "高三", "学生"]],
    [
      "Thai",
      "ฉันเรียนอยู่ชั้นมัธยมปีที่ 6",
      ["ฉัน", "เรียน", "อยู่", "ชั้น", "มัธยม", "ปี", "ที่", "6"],
    ],
    [
      "Arabic",
      "أنا في الصف الحادي عشر",
      ["أنا", "في", "الصف", "الحادي", "عشر"],
    ],
    ["Hindi", "मैं कक्षा 11 में हूँ", ["मैं", "कक्षा", "11", "में", "हूँ"]],
  ])(
    "finds the words of a %s text, in a script that may put no space between words",
    (_, text, expected) => {
      const words = wordsOf(text);
      expect(Arr.take(words, Arr.length(expected))).toEqual(expected);
      // A word is never a whole sentence, which is what splitting at spaces would find.
      expect(words).not.toContain(text);
    }
  );

  it("cuts a long word to six characters, so that cognates become one word", () => {
    expect(wordsOf("trigonometri trigonometry Trigonometrie")).toEqual([
      "trigon",
    ]);
    expect(wordsOf("matematika mathematics")).toEqual(["matema", "mathem"]);
    // A word of exactly six characters stays whole.
    expect(wordsOf("limits")).toEqual(["limits"]);
  });

  it("reads one form of a character: full width letters and ligatures become plain ones", () => {
    expect(wordsOf("ＳＮＢＴ ﬁnal")).toEqual(["snbt", "final"]);
  });

  it("counts and cuts by character, never between the two halves of one", () => {
    // Each of these letters takes two code units, and seven of them are one word.
    const deseret = Arr.map(Arr.range(0x1_04_28, 0x1_04_2e), (code) =>
      String.fromCodePoint(code)
    );
    expect(wordsOf(Arr.join(deseret, ""))).toEqual([
      Arr.join(Arr.take(deseret, 6), ""),
    ]);
  });

  it("finds nothing in a text without a word", () => {
    expect(wordsOf("")).toEqual([]);
    expect(wordsOf("  ... ?! -- 😀😀😀")).toEqual([]);
  });
});

describe("memory words looked up first", () => {
  it("takes the longest words first, and words of one length in the order they came", () => {
    expect(
      longest(["di", "trigon", "ke", "limit", "turuna", "yang", "ipa"], 4)
    ).toEqual(["trigon", "turuna", "limit", "yang"]);
    expect(longest(["bb", "aa", "cc", "dd"], 3)).toEqual(["bb", "aa", "cc"]);
  });

  it("takes all of them when there are no more than the limit, still longest first, and none for a limit of zero", () => {
    expect(longest(["di", "limit"], 5)).toEqual(["limit", "di"]);
    expect(longest(["di", "limit"], 0)).toEqual([]);
    expect(longest([], 3)).toEqual([]);
  });

  it("counts a word by character, so that an emoji letter counts once", () => {
    const two = "\u{10428}\u{10429}";
    expect(longest(["abc", two], 1)).toEqual(["abc"]);
    expect(longest(["ab", two, "a"], 3)).toEqual(["ab", two, "a"]);
  });
});

describe("memory word worth", () => {
  it("is the most a word is worth for a word that one memory holds, and the inverse of how many memories hold it", () => {
    expect(wordWorth(1)).toBe(WORD_WORTH);
    expect(wordWorth(2)).toBe(WORD_WORTH / 2);
    expect(wordWorth(8)).toBe(WORD_WORTH / 8);
  });

  it("falls with every memory that holds the word, and a word that 24 hold is worth less than any word that fewer hold", () => {
    const worth = Arr.map(Arr.range(1, 24), wordWorth);
    expect(Arr.headNonEmpty(worth)).toBe(WORD_WORTH);
    expect(
      Arr.every(
        Arr.zip(worth, Arr.drop(worth, 1)),
        ([earlier, later]) => earlier > later
      )
    ).toBe(true);
  });
});
